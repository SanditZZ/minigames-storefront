package settings

import "regexp"

// hexColor matches a CSS hex literal in short or long form, either case.
var hexColor = regexp.MustCompile(`^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$`)

// IsHexColor reports whether a setting value is a hex colour literal — `#abc`
// or `#aabbcc` — and nothing else.
//
// The narrowness is the security property, not a formatting preference. A
// SettingColor value is served to the player app, which writes it into a CSS
// custom property on its own document; accepting anything CSS accepts would let
// an admin-set string carry `url(https://…)` (a request to a third party from
// every player's browser) or `var(--something-else)` into the style engine. A
// hex literal cannot express anything but a colour, so validating here means
// nothing downstream has to sanitise.
//
// It rejects the 4- and 8-digit alpha forms deliberately: these values become
// the *base* colours that opacity utilities (`text-ink/70`) mix against, and a
// base colour that is already translucent compounds into something nobody
// picked. The same rule is enforced client-side in packages/tokens/override.ts;
// this copy is the one that decides, since a browser is not a trust boundary.
func IsHexColor(value string) bool { return hexColor.MatchString(value) }
