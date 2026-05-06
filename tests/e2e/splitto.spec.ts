import { test, expect, Page } from '@playwright/test';
import { HomePage } from './pages/home.page';
import { GroupPage } from './pages/group.page';

/**
 * Tests E2E pour Splitto — 4 scénarios obligatoires
 *
 * Scénario 1: Créer un groupe avec 3 membres
 * Scénario 2: Ajouter une dépense
 * Scénario 3: Vérifier les soldes mis à jour
 * Scénario 4: Marquer un règlement comme réglé
 */

async function resetDatabase(baseURL: string) {
  await fetch(`${baseURL}/_test/reset`, { method: 'POST' });
}

test.beforeEach(async ({ baseURL }) => {
  // Isolation totale : reset la DB avant chaque test
  if (baseURL) {
    await resetDatabase(baseURL);
  }
});

test('Scénario 1: Créer un groupe avec 3 membres', async ({ page, baseURL }) => {
  const homePage = new HomePage(page);

  // Aller à la page d'accueil
  await homePage.goto();

  // Cliquer sur "Nouveau groupe"
  await homePage.clickNewGroupButton();

  // Remplir le formulaire avec 3 membres
  const groupName = 'Vacances Italie';
  const members = ['Alice <alice@example.com>', 'Bob <bob@example.com>', 'Charlie <charlie@example.com>'];
  await homePage.fillNewGroupForm(groupName, 'EUR', members);

  // Soumettre le formulaire
  await homePage.submitNewGroupForm();

  // Vérifier que le groupe apparaît dans la liste
  await expect(homePage.getGroupCard(groupName)).toBeVisible();
  const isVisible = await homePage.isGroupVisible(groupName);
  expect(isVisible).toBe(true);
});

test('Scénario 2: Ajouter une dépense', async ({ page, baseURL }) => {
  const homePage = new HomePage(page);
  const groupPage = new GroupPage(page);

  // Créer un groupe d'abord
  await homePage.goto();
  await homePage.clickNewGroupButton();
  const groupName = 'Week-end Paris';
  const members = ['Alice <alice@example.com>', 'Bob <bob@example.com>', 'Charlie <charlie@example.com>'];
  await homePage.fillNewGroupForm(groupName, 'EUR', members);
  await homePage.submitNewGroupForm();

  // Aller dans le groupe
  await homePage.clickGroupByName(groupName);

  // Vérifier qu'il n'y a pas de dépenses au départ
  const initialCount = await groupPage.getExpenseRowCount();
  expect(initialCount).toBe(0);

  // Ajouter une dépense
  await groupPage.clickAddExpenseButton();
  const description = 'Restaurant';
  const amount = '90';

  const paidByOption = page.locator('select[name="paidBy"] option').first();
  const firstMemberId = await paidByOption.getAttribute('value');
  expect(firstMemberId).toBeTruthy();

  const beneficiaries = await page.locator('input[name="beneficiary"]').all();
  const beneficiaryIds = await Promise.all(beneficiaries.map(b => b.getAttribute('value')));
  expect(beneficiaryIds.every(Boolean)).toBe(true);

  await groupPage.fillNewExpenseForm(description, amount, firstMemberId as string, beneficiaryIds as string[]);
  await groupPage.submitNewExpenseForm();

  // Vérifier que la dépense a été ajoutée
  const finalCount = await groupPage.getExpenseRowCount();
  expect(finalCount).toBe(1);
});

test('Scénario 3: Voir les soldes mis à jour', async ({ page, baseURL }) => {
  const homePage = new HomePage(page);
  const groupPage = new GroupPage(page);

  // Créer un groupe avec 3 membres
  await homePage.goto();
  await homePage.clickNewGroupButton();
  const groupName = 'Trip Espagne';
  const members = ['Alice <alice@example.com>', 'Bob <bob@example.com>', 'Charlie <charlie@example.com>'];
  await homePage.fillNewGroupForm(groupName, 'EUR', members);
  await homePage.submitNewGroupForm();

  // Aller dans le groupe
  await homePage.clickGroupByName(groupName);

  // Ajouter une dépense de 30€ payée par Alice, divisée entre 3 personnes (equal split)
  // Alice paie 30€ pour elle-même + 2 autres = Alice +20, Bob -10, Charlie -10
  await groupPage.clickAddExpenseButton();

  // Récupérer les IDs des membres
  const memberOptions = await page.locator('select[name="paidBy"] option').all();
  let aliceId = '';
  let bobId = '';
  let charlieId = '';

  for (const option of memberOptions) {
    const value = await option.getAttribute('value');
    const text = await option.textContent();
    if (text?.includes('Alice')) aliceId = value || '';
    if (text?.includes('Bob')) bobId = value || '';
    if (text?.includes('Charlie')) charlieId = value || '';
  }

  expect(aliceId).toBeTruthy();
  expect(bobId).toBeTruthy();
  expect(charlieId).toBeTruthy();

  await groupPage.fillNewExpenseForm('Hôtel', '30', aliceId, [aliceId, bobId, charlieId]);
  await groupPage.submitNewExpenseForm();

  // Vérifier les soldes
  // Alice doit être créditrice de 20€
  const aliceBalance = await groupPage.getBalance(aliceId);
  expect(aliceBalance).toBe(20);

  // Bob doit être débiteur de 10€
  const bobBalance = await groupPage.getBalance(bobId);
  expect(bobBalance).toBe(-10);

  // Charlie doit être débiteur de 10€
  const charlieBalance = await groupPage.getBalance(charlieId);
  expect(charlieBalance).toBe(-10);
});

test('Scénario 4: Marquer un règlement comme réglé', async ({ page, baseURL }) => {
  const homePage = new HomePage(page);
  const groupPage = new GroupPage(page);

  // Créer un groupe avec 2 membres
  await homePage.goto();
  await homePage.clickNewGroupButton();
  const groupName = 'Dîner pizza';
  const members = ['Alice <alice@example.com>', 'Bob <bob@example.com>'];
  await homePage.fillNewGroupForm(groupName, 'EUR', members);
  await homePage.submitNewGroupForm();

  // Aller dans le groupe
  await homePage.clickGroupByName(groupName);

  // Ajouter une dépense simple : 20€ payée par Alice, Bob bénéficiaire
  await groupPage.clickAddExpenseButton();

  const memberOptions = await page.locator('select[name="paidBy"] option').all();
  let aliceId = '';
  let bobId = '';

  for (const option of memberOptions) {
    const value = await option.getAttribute('value');
    const text = await option.textContent();
    if (text?.includes('Alice')) aliceId = value || '';
    if (text?.includes('Bob')) bobId = value || '';
  }

  expect(aliceId).toBeTruthy();
  expect(bobId).toBeTruthy();

  // Alice paie 20€, seul Bob en bénéficie => Alice +20, Bob -20
  await groupPage.fillNewExpenseForm('Pizza', '20', aliceId, [bobId]);
  await groupPage.submitNewExpenseForm();

  // Vérifier qu'il y a 1 settlement (Bob doit 20€ à Alice)
  const initialSettlementCount = await groupPage.getSettlementRowCount();
  expect(initialSettlementCount).toBe(1);

  // Cliquer sur "Régler" pour le settlement à l'index 0
  await groupPage.clickSettleButtonByIndex(0);

  // Vérifier que le settlement a disparu
  const settlementVisible = await groupPage.isSettlementRowVisible(0);
  expect(settlementVisible).toBe(false);

  // Vérifier que le message de succès s'affiche
  const alertText = await groupPage.getAlertText();
  expect(alertText).toContain('Règlement marqué comme effectué');
});
