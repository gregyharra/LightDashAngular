import nx from "@nx/eslint-plugin";

export default [
    ...nx.configs["flat/base"],
    ...nx.configs["flat/typescript"],
    ...nx.configs["flat/javascript"],
    {
        ignores: [
            "**/dist",
            "**/out-tsc"
        ]
    },
    {
        files: [
            "**/*.ts",
            "**/*.tsx",
            "**/*.js",
            "**/*.jsx"
        ],
        rules: {
            "@nx/enforce-module-boundaries": [
                "error",
                {
                    enforceBuildableLibDependency: true,
                    allow: ["remote-auth/Routes"],
                    depConstraints: [
                        {
                            sourceTag: "type:models",
                            onlyDependOnLibsWithTags: []
                        },
                        {
                            sourceTag: "type:core",
                            onlyDependOnLibsWithTags: [
                                "type:models"
                            ]
                        },
                        {
                            sourceTag: "type:shared",
                            onlyDependOnLibsWithTags: [
                                "type:models",
                                "type:core"
                            ]
                        },
                        {
                            sourceTag: "type:feature",
                            onlyDependOnLibsWithTags: [
                                "type:models",
                                "type:core",
                                "type:shared"
                            ]
                        },
                        {
                            sourceTag: "type:app",
                            onlyDependOnLibsWithTags: [
                                "type:models",
                                "type:core",
                                "type:shared",
                                "type:feature"
                            ]
                        }
                    ]
                }
            ]
        }
    },
    {
        files: [
            "**/*.ts",
            "**/*.tsx",
            "**/*.cts",
            "**/*.mts",
            "**/*.js",
            "**/*.jsx",
            "**/*.cjs",
            "**/*.mjs"
        ],
        // Override or add rules here
        rules: {}
    }
];
