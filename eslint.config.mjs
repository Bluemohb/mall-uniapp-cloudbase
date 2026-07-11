import uniHelper from '@uni-helper/eslint-config'

export default uniHelper(
  {},

  // 忽略文件
  {
    ignores: [
      'dist/**',
      'build/**',
      'node_modules/**',
      '**/uni_modules/**',
      'src/uni_modules/**',
      'unpackage/**',
      'README.md',
    ],
  },

  // 全局变量 + uni-app 适配
  {
    languageOptions: {
      globals: {
        uni: 'readonly',
        getApp: 'readonly',
        getCurrentPages: 'readonly',
        wx: 'readonly',
      },
    },
    rules: {
      'vue/multi-word-component-names': 'off',
      'no-console': 'off', // 允许 console（开发调试需要）
      'no-unused-vars': 'off', // 允许未使用的变量（模板占位）
      'no-useless-catch': 'off', // 允许空 catch 块
      'ts/no-unsafe-function-type': 'off', // 允许 Function 类型（兼容旧 API）
      'ts/no-empty-object-type': 'off', // 允许 {} 类型（声明文件常用）
      // 'ts/no-explicit-any': 'off', // 允许 any 类型（模板常用）
      'style/no-tabs': 'off', // 允许 Tab 字符
      'style/no-mixed-spaces-and-tabs': 'off', // 允许空格和 Tab 混合
      'unused-imports/no-unused-vars': 'off', // 允许未使用的导入变量
      'perfectionist/sort-objects': 'off', // 不强制对象属性排序
    },
  },
)
