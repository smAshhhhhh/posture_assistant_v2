const { withGradleProperties } = require('expo/config-plugins');

/** @type {import('expo/config-plugins').ConfigPlugin} */
module.exports = (config) =>
  withGradleProperties(config, (androidConfig) => {
    const managedKeys = ['android.cmakeVersion', 'expo.android.cmakeObjectPathMax'];
    const properties = androidConfig.modResults.filter(
      (property) => property.type !== 'property' || !managedKeys.includes(property.key),
    );

    // 固定原生编译工具版本，配置随 Prebuild 保留。
    properties.push({ type: 'property', key: 'android.cmakeVersion', value: '3.30.5' });

    if (process.platform === 'win32') {
      // 让 CMake 缩短中间文件路径，兼容不支持长路径的 Ninja。
      properties.push({
        type: 'property',
        key: 'expo.android.cmakeObjectPathMax',
        value: '240',
      });
    }

    androidConfig.modResults = properties;

    return androidConfig;
  });
