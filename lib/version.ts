// The release this build belongs to: package.json's one version (CLAUDE.md
// rule 4, COMMON-PROJECT-SPEC C13 in second-brain; CHANGELOG.md says what each
// version brought), read at build time through a named JSON import.
//
// Import it from SERVER code only and hand the string down as a prop. Turbopack
// does not tree-shake a JSON module: imported into a client component, this
// shipped the whole of package.json — name, description, every dependency and
// its version — in a browser chunk (measured in `.next/static` on 2026-10-17).
// `app/[view]/page.tsx` passes it to CalendarApp, which shows it in the
// topbar's options, so a phone in hand says which build the Home Lab serves.
import { version } from "../package.json";

export const APP_VERSION: string = version;
