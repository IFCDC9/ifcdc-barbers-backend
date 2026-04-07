module.exports = function (api) {
  api.cache.using(function () {
    return process.env.BABEL_ENV || process.env.NODE_ENV || "development"
  })
  return {
    presets: ["babel-preset-expo"],
  }
}
