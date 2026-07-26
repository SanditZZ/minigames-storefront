// Image editing that is not editing: the pure geometry behind a crop-and-zoom
// control.
//
// It is its own package, rather than living in admin-core, because cropping is
// not an admin concern — it is a *client* concern that the admin happens to
// need first. The roadmap already anticipates the player uploading images, and
// a React Native cropper would want exactly these functions with a different
// gesture layer on top. Same boundary as every other package here: no React, no
// `window`, no canvas, no network.

export * from "./crop";
