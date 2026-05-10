import { Page } from '@playwright/test';

/**
 * Page Object pour la page d'accueil (liste des groupes)
 */
export class HomePage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/');
  }

  async clickNewGroupButton() {
    await this.page.getByRole('button', { name: /nouveau groupe/i }).click();
  }

  async fillNewGroupForm(name: string, currency: string, members: string[]) {
    await this.page.getByLabel(/nom du groupe/i).fill(name);
    await this.page.getByLabel(/devise/i).selectOption(currency);
    await this.page.getByLabel(/membres/i).fill(members.join('\n'));
  }

  async submitNewGroupForm() {
    await Promise.all([
      this.page.waitForResponse(response =>
        response.url().endsWith('/api/groups') && response.request().method() === 'POST' && response.status() === 201,
      ),
      this.page
        .getByRole('button', { name: /créer/i })
        .click(),
    ]);

    await this.page.getByRole('listitem').first().waitFor({ state: 'visible' });
  }

  async cancelNewGroupForm() {
    await this.page
      .getByRole('dialog', { name: /créer un groupe/i })
      .getByRole('button', { name: /annuler/i })
      .click();
  }

  getGroupCard(groupName: string) {
    return this.page.getByText(groupName);
  }

  async clickGroupByName(groupName: string) {
    const card = this.getGroupCard(groupName);
    await card.click();
  }

  async isGroupVisible(groupName: string) {
    const card = this.getGroupCard(groupName);
    return card.isVisible();
  }

  async getAlert() {
    return this.page.getByRole('alert').first();
  }

  async getAlertText() {
    const alert = await this.getAlert();
    return alert.textContent();
  }
}
