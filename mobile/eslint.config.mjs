import expoConfig from 'eslint-config-expo/flat.js';
import prettierConfig from 'eslint-config-prettier/flat';

export default [
  ...expoConfig,
  prettierConfig,
  {
    ignores: ['node_modules/**', '.expo/**', '.local/**', 'android/**', 'ios/**', 'dist/**'],
  },
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'max-lines': ['warn', { max: 350, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    files: ['src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'react',
                'react-native',
                'expo*',
                'heroui-native*',
                '@react-navigation/*',
                '@/app/**',
                '@/features/**',
                '@/data/**',
                '@/native/**',
                '@/shared/ui/**',
              ],
              message: '领域逻辑必须保持纯业务依赖。',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/features/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@/features/**',
                '@/data/**',
                '@/native/**',
                'expo-sqlite',
                'expo-file-system',
              ],
              message: '功能内部使用相对导入；跨功能通过导航或领域类型协作。',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/shared/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/app/**', '@/features/**', '@/data/**', '@/native/**'],
              message: '公共模块不能反向依赖应用或功能模块。',
            },
          ],
        },
      ],
    },
  },
];
