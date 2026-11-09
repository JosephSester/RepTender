/** `#/crash-test`: breaks on purpose so the iPhone checklist can check the error screen (spec §11). */
export default function CrashTest(): never {
  throw new Error('Crash test: this screen breaks on purpose.');
}
