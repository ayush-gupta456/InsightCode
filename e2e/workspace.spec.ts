import { test, expect } from "@playwright/test";
test("private workspace, source upload, findings, navigation and responsive layout", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Ship with confidence/ }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Start your first review" }).click();
  await page.getByLabel("Your name").fill("Browser QA");
  await page
    .getByLabel("Email address")
    .fill(`browser-${Date.now()}@example.test`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("browser-test-password-123");
  await page
    .getByRole("button", { name: "Create workspace", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Welcome back, Browser." }),
  ).toBeVisible();
  await page.screenshot({
    path: "docs/screenshots/dashboard.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Projects", exact: true }).click();
  await page.getByRole("button", { name: "New project", exact: true }).click();
  await page.getByLabel("Project name").fill("Browser test project");
  await page
    .getByLabel("Description", { exact: true })
    .fill("Created by the automated end-to-end test");
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Browser test project", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Review code", exact: true }).click();
  await page.getByRole("button", { name: "Upload files", exact: true }).click();
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "example.ts",
      mimeType: "text/plain",
      buffer: Buffer.from(
        "export function parse(input: string) {\n  return eval(input);\n}\n",
      ),
    });
  await page
    .getByLabel("Review name", { exact: true })
    .fill("Browser security check");
  await page.getByRole("button", { name: "Start review", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Browser security check", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Dynamic code execution", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("heading", { name: "Dynamic code execution", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Recommendation", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "docs/screenshots/review-workspace.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Index", exact: true }).click();
  await expect(
    page.getByText("FunctionDeclaration", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.locator(".symbol-row").getByText("parse", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Assistant", exact: true }).click();
  await page
    .getByRole("button", { name: "Explain the architecture", exact: true })
    .click();
  await expect(page.getByLabel("Ask the AI assistant")).toHaveValue(
    "Explain the architecture",
  );
  await page.getByRole("button", { name: "Review logs", exact: true }).click();
  await expect(
    page.getByText(
      "Review complete. Security hotspots require human confirmation.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.keyboard.press("Control+k");
  await expect(
    page.getByRole("heading", { name: "Search your workspace" }),
  ).toBeVisible();
  await page.getByPlaceholder("Search reviews and pages…").fill("Quality");
  await page
    .getByRole("dialog")
    .getByRole("link", { name: "Quality analytics" })
    .click();
  await expect(
    page.getByRole("heading", { name: "How the score works" }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/app");
  await expect(
    page.getByRole("heading", { name: "Welcome back, Browser." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "docs/screenshots/mobile.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
