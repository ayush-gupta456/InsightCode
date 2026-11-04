import { test, expect } from "@playwright/test";

for (const route of ["/login", "/register"]) {
  test(`password visibility can be toggled without submitting ${route}`, async ({ page }) => {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    const password = page.getByLabel("Password", { exact: true });
    await password.fill("visibility-test-password");
    await expect(password).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: "Show password", exact: true }).click();
    await expect(password).toHaveAttribute("type", "text");
    await expect(password).toHaveValue("visibility-test-password");
    await page.getByRole("button", { name: "Hide password", exact: true }).click();
    await expect(password).toHaveAttribute("type", "password");
    await expect(page).toHaveURL(new RegExp(`${route}$`));
  });
}
