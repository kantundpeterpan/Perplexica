import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import os from 'os';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TIMEOUT_MS = 10_000;
const MAX_OUTPUT_BYTES = 64 * 1024; // 64 KB

const bodySchema = z.object({
  code: z.string().min(1, 'Code is required'),
  language: z.string().min(1, 'Language is required'),
});

const SUPPORTED: Record<
  string,
  { bin: string; ext: string; buildArgs: (f: string) => string[] }
> = {
  python: { bin: 'python3', ext: 'py', buildArgs: (f) => [f] },
  python3: { bin: 'python3', ext: 'py', buildArgs: (f) => [f] },
  javascript: { bin: 'node', ext: 'js', buildArgs: (f) => [f] },
  js: { bin: 'node', ext: 'js', buildArgs: (f) => [f] },
};

export async function POST(req: NextRequest) {
  // Code execution must be explicitly enabled via environment variable.
  // WARNING: This endpoint executes arbitrary code on the server process.
  // Only enable in trusted, sandboxed environments.
  if (process.env.ENABLE_CODE_EXECUTION !== 'true') {
    return NextResponse.json(
      {
        stdout: '',
        stderr:
          'Code execution is disabled. Set ENABLE_CODE_EXECUTION=true to enable it.',
        exitCode: 1,
      },
      { status: 200 },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues
          .map((e: z.ZodIssue) => e.message)
          .join(', '),
      },
      { status: 400 },
    );
  }

  const { code, language } = parsed.data;
  const lang = language.toLowerCase();
  const runner = SUPPORTED[lang];

  if (!runner) {
    return NextResponse.json(
      {
        stdout: '',
        stderr: `Language "${language}" is not supported for execution. Supported: ${Object.keys(SUPPORTED).join(', ')}.`,
        exitCode: 1,
      },
      { status: 200 },
    );
  }

  const tmpFile = join(
    os.tmpdir(),
    `perplexica-cell-${Date.now()}.${runner.ext}`,
  );
  try {
    writeFileSync(tmpFile, code, { mode: 0o600 });
  } catch {
    return NextResponse.json(
      { error: 'Failed to write temporary file' },
      { status: 500 },
    );
  }

  return new Promise<NextResponse>((resolve) => {
    execFile(
      runner.bin,
      runner.buildArgs(tmpFile),
      {
        timeout: TIMEOUT_MS,
        maxBuffer: MAX_OUTPUT_BYTES * 2,
        env: { ...process.env },
      },
      (err, stdout, stderr) => {
        try {
          unlinkSync(tmpFile);
        } catch {
          // ignore
        }

        const exitCode =
          err && (err as NodeJS.ErrnoException & { code?: number }).code != null
            ? Number((err as NodeJS.ErrnoException & { code?: number }).code)
            : err
              ? 1
              : 0;

        resolve(
          NextResponse.json({
            stdout: (stdout ?? '').slice(0, MAX_OUTPUT_BYTES),
            stderr: (
              (stderr ?? '') +
              (err?.signal ? `\nProcess killed by signal: ${err.signal}` : '')
            ).slice(0, MAX_OUTPUT_BYTES),
            exitCode,
          }),
        );
      },
    );
  });
}
