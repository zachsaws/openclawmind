import fs from 'node:fs';
import path from 'node:path';
import OpenAI from 'openai';
import type { Responses } from 'openai/resources/responses/responses';
import { chromium, type Browser, type Page } from 'playwright';

const DISPLAY_WIDTH = Number(process.env.OPENAI_COMPUTER_WIDTH ?? 1280);
const DISPLAY_HEIGHT = Number(process.env.OPENAI_COMPUTER_HEIGHT ?? 800);
const MAX_STEPS = Number(process.env.OPENAI_COMPUTER_MAX_STEPS ?? 25);
const MODEL = process.env.OPENAI_COMPUTER_MODEL ?? 'computer-use-preview-2025-03-11';
const START_URL = process.env.OPENAI_COMPUTER_START_URL ?? 'https://example.com';
const OUTPUT_DIR = path.resolve(process.cwd(), '.computer-use');
const DEFAULT_PROMPT = `Open ${START_URL}, explain what you see, then stop.`;

type ComputerAction =
  | NonNullable<Responses.ResponseComputerToolCall['action']>
  | Responses.ComputerAction;

function requireApiKey(): string {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set.');
  }
  return apiKey;
}

function promptFromCli(): string {
  const args = process.argv.slice(2).join(' ').trim();
  return args.length > 0 ? args : DEFAULT_PROMPT;
}

function ensureOutputDir(): void {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function toDataUrl(pngBytes: Buffer): string {
  return `data:image/png;base64,${pngBytes.toString('base64')}`;
}

function normalizeKey(key: string): string {
  const upper = key.toUpperCase();
  const aliasMap: Record<string, string> = {
    ALT: 'Alt',
    BACKSPACE: 'Backspace',
    CMD: 'Meta',
    COMMAND: 'Meta',
    CONTROL: 'Control',
    CTRL: 'Control',
    DEL: 'Delete',
    DOWN: 'ArrowDown',
    ENTER: 'Enter',
    ESC: 'Escape',
    ESCAPE: 'Escape',
    LEFT: 'ArrowLeft',
    OPTION: 'Alt',
    PGDN: 'PageDown',
    PGUP: 'PageUp',
    RETURN: 'Enter',
    RIGHT: 'ArrowRight',
    SPACE: ' ',
    TAB: 'Tab',
    UP: 'ArrowUp',
  };

  if (aliasMap[upper]) {
    return aliasMap[upper];
  }

  if (upper.length === 1) {
    return upper;
  }

  return key;
}

async function captureScreenshot(page: Page, step: number): Promise<string> {
  const screenshot = await page.screenshot({ fullPage: false, type: 'png' });
  const screenshotPath = path.join(OUTPUT_DIR, `step-${String(step).padStart(2, '0')}.png`);
  fs.writeFileSync(screenshotPath, screenshot);
  return toDataUrl(screenshot);
}

async function executeAction(page: Page, action: ComputerAction): Promise<void> {
  switch (action.type) {
    case 'click': {
      const button =
        action.button === 'wheel' ? 'middle' : action.button === 'back' || action.button === 'forward' ? 'left' : action.button;
      await page.mouse.click(action.x, action.y, { button });
      return;
    }
    case 'double_click':
      await page.mouse.dblclick(action.x, action.y);
      return;
    case 'move':
      await page.mouse.move(action.x, action.y);
      return;
    case 'scroll':
      await page.mouse.move(action.x, action.y);
      await page.mouse.wheel(action.scroll_x, action.scroll_y);
      return;
    case 'drag': {
      const [first, ...rest] = action.path;
      if (!first) {
        return;
      }
      await page.mouse.move(first.x, first.y);
      await page.mouse.down();
      for (const point of rest) {
        await page.mouse.move(point.x, point.y);
      }
      await page.mouse.up();
      return;
    }
    case 'keypress': {
      for (const key of action.keys) {
        await page.keyboard.down(normalizeKey(key));
      }
      for (const key of [...action.keys].reverse()) {
        await page.keyboard.up(normalizeKey(key));
      }
      return;
    }
    case 'type':
      await page.keyboard.type(action.text);
      return;
    case 'wait':
      await page.waitForTimeout(1000);
      return;
    case 'screenshot':
      return;
    default: {
      const unreachable: never = action;
      throw new Error(`Unsupported action: ${JSON.stringify(unreachable)}`);
    }
  }
}

function getComputerCall(response: Responses.Response): Responses.ResponseComputerToolCall | undefined {
  return response.output.find(
    (item): item is Responses.ResponseComputerToolCall => item.type === 'computer_call',
  );
}

function getActions(call: Responses.ResponseComputerToolCall): ComputerAction[] {
  if (call.actions && call.actions.length > 0) {
    return call.actions;
  }
  if (call.action) {
    return [call.action];
  }
  return [];
}

async function createBrowser(): Promise<{ browser: Browser; page: Page }> {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: DISPLAY_WIDTH, height: DISPLAY_HEIGHT },
  });
  const page = await context.newPage();
  await page.goto(START_URL, { waitUntil: 'domcontentloaded' });
  return { browser, page };
}

function logStep(step: number, actions: ComputerAction[]): void {
  const summary = actions.map((action) => action.type).join(', ') || 'no action';
  console.log(`step ${step}: ${summary}`);
}

async function main(): Promise<void> {
  ensureOutputDir();

  const client = new OpenAI({ apiKey: requireApiKey() });
  const task = promptFromCli();
  const { browser, page } = await createBrowser();

  try {
    let response = await client.responses.create({
      model: MODEL,
      tools: [
        {
          type: 'computer_use_preview',
          environment: 'browser',
          display_width: DISPLAY_WIDTH,
          display_height: DISPLAY_HEIGHT,
        },
      ],
      input: task,
      truncation: 'auto',
    });

    for (let step = 1; step <= MAX_STEPS; step += 1) {
      const computerCall = getComputerCall(response);
      if (!computerCall) {
        console.log('\nassistant:\n');
        console.log(response.output_text || '[no text output]');
        return;
      }

      const actions = getActions(computerCall);
      logStep(step, actions);

      if (computerCall.pending_safety_checks.length > 0) {
        for (const check of computerCall.pending_safety_checks) {
          console.warn(`safety check: ${check.code ?? 'unknown'} ${check.message ?? ''}`.trim());
        }
      }

      for (const action of actions) {
        await executeAction(page, action);
      }

      const imageUrl = await captureScreenshot(page, step);

      response = await client.responses.create({
        model: MODEL,
        previous_response_id: response.id,
        tools: [
          {
            type: 'computer_use_preview',
            environment: 'browser',
            display_width: DISPLAY_WIDTH,
            display_height: DISPLAY_HEIGHT,
          },
        ],
        input: [
          {
            type: 'computer_call_output',
            call_id: computerCall.call_id,
            acknowledged_safety_checks: computerCall.pending_safety_checks,
            output: {
              type: 'computer_screenshot',
              image_url: imageUrl,
            },
          },
        ],
        truncation: 'auto',
      });
    }

    throw new Error(`Stopped after ${MAX_STEPS} steps without reaching a final answer.`);
  } finally {
    await page.context().close();
    await browser.close();
  }
}

main().catch((error: unknown) => {
  let message = error instanceof Error ? error.message : String(error);
  if (message.includes('computer-use-preview') && message.includes('do not have access')) {
    message =
      `${message}\nRequest access to the computer use preview model, or switch OPENAI_COMPUTER_MODEL to a model your account can use.`;
  }
  console.error(message);
  process.exitCode = 1;
});
