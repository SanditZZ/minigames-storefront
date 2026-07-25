module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      // jsxImportSource is what lets a <View className="…"> compile at all:
      // NativeWind swaps in its own JSX factory, which turns the class string
      // into a style object. Without it every className is silently ignored.
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
  };
};
