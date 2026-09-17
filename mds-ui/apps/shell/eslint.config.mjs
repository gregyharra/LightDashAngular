import nx from "@nx/eslint-plugin";
import baseConfig, { moduleBoundaryOptions } from "../../eslint.config.mjs";

export default [
    ...nx.configs["flat/angular"],
    ...nx.configs["flat/angular-template"],
    ...baseConfig,
    {
        files: [
            "**/*.ts"
        ],
        rules: {
            "@angular-eslint/directive-selector": [
                "error",
                {
                    type: "attribute",
                    prefix: "app",
                    style: "camelCase"
                }
            ],
            "@angular-eslint/component-selector": [
                "error",
                {
                    type: "element",
                    prefix: "app",
                    style: "kebab-case"
                }
            ],
            "@nx/enforce-module-boundaries": [
                "error",
                {
                    ...moduleBoundaryOptions,
                    allow: [
                        "remote-auth/Routes",
                        "remote-projects/Routes",
                        "remote-warehouses/Routes",
                        "remote-tables/Routes"
                    ]
                }
            ]
        }
    },
    {
        files: [
            "**/*.html"
        ],
        // Override or add rules here
        rules: {}
    }
];
