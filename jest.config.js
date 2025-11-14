module.exports = {
    testEnvironment: 'node',
    preset: 'ts-jest',
    testMatch: ['**/?(*.)+(test).ts'],
    moduleFileExtensions: ['ts', 'js', 'json'],
    restoreMocks: true,
    resetMocks: true,
    moduleDirectories: ['node_modules', '<rootDir>/src'],

    transform: {
        '^.+\\.ts$': 'ts-jest', // TypeScript handled by ts-jest
        'node_modules/uuid/.+\\.js$': '<rootDir>/babel-jest-transformer.js', // 👈 force Babel for uuid
    },

    transformIgnorePatterns: [
        'node_modules/(?!uuid/)', // allow uuid to be transformed
    ],
};