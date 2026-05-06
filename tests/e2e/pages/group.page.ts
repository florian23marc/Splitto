import { Page } from '@playwright/test';

/**
 * Page Object pour la page détail du groupe
 */
export class GroupPage {
  constructor(private page: Page) {}

  async clickAddExpenseButton() {
    await this.page.getByRole('button', { name: /ajouter une dépense/i }).click();
  }

  async fillNewExpenseForm(
    description: string,
    amount: string,
    paidBy: string,
    beneficiaries: string[],
  ) {
    await this.page.getByLabel(/description/i).fill(description);
    await this.page.getByLabel(/montant/i).fill(amount);
    await this.page.getByLabel(/payé par/i).selectOption(paidBy);

    // Décocher tous les bénéficiaires d'abord
    const checkboxes = await this.page
      .locator('input[name="beneficiary"]')
      .all();
    for (const checkbox of checkboxes) {
      await checkbox.uncheck();
    }

    // Cocher les bénéficiaires sélectionnés
    for (const beneficiary of beneficiaries) {
      await this.page
        .locator(`input[name="beneficiary"][value="${beneficiary}"]`)
        .check();
    }
  }

  async submitNewExpenseForm() {
    await Promise.all([
      this.page.waitForResponse(response =>
        response.url().includes('/api/groups/') && response.request().method() === 'POST' && response.status() === 201,
      ),
      this.page
        .locator('#form-new-expense')
        .getByRole('button', { name: /ajouter/i })
        .click(),
    ]);

    await this.page.locator('#btn-new-expense').waitFor({ state: 'visible' });
  }

  async cancelNewExpenseForm() {
    await this.page
      .locator('#dlg-new-expense')
      .getByRole('button', { name: /annuler/i })
      .click();
  }

  async getExpenseTable() {
    return this.page.getByRole('table', { name: /liste des dépenses/i });
  }

  async getExpenseRowCount() {
    const table = this.page.getByRole('table', { name: /liste des dépenses/i });
    if ((await table.count()) === 0) return 0;
    const rows = table.getByRole('row');
    return Math.max(0, await rows.count() - 1);
  }

  async getBalance(memberId: string) {
    const balanceCell = await this.page
      .getByTestId(`balance-${memberId}`)
      .first();
    const text = await balanceCell.textContent();
    // Le texte est au format "XX.XX EUR" ou "-XX.XX EUR"
    if (!text) return null;
    const match = text.match(/([-\d.]+)/);
    return match ? parseFloat(match[1]) : null;
  }

  async getSettlementRowCount() {
    const table = this.page.getByRole('table', { name: /règlements/i });
    if ((await table.count()) === 0) return 0;
    const rows = table.getByRole('row');
    return Math.max(0, await rows.count() - 1);
  }

  async clickSettleButtonByIndex(index: number) {
    const row = this.page.getByTestId(`settlement-row-${index}`);
    await row.getByRole('button', { name: /régler/i }).click();
  }

  async isSettlementRowVisible(index: number) {
    const row = this.page.getByTestId(`settlement-row-${index}`);
    return row.isVisible();
  }

  async getAlert() {
    return this.page.getByRole('alert').first();
  }

  async getAlertText() {
    const alert = await this.getAlert();
    return alert.textContent();
  }
}
