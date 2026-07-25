/// <reference types="nativewind/types" />

// global.css is imported for its side effect: NativeWind's Metro transformer
// turns it into the compiled style registry. TypeScript has no idea what a .css
// module is on this platform, so it needs telling one exists.
declare module "*.css";
