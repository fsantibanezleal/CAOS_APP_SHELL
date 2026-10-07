# The shell, documented

`@fasl-work/caos-app-shell` is one of the three parts of the CAOS base (ADR-0078, "rules live in the base"):

| Part | Where | Owns |
|---|---|---|
| The shell | this repository, published to npm | every pixel rule: tokens, the frame, the route types, navigation, views, drawings, numbers, icons; and the measured gate |
| The product template | [CAOS_PRODUCT_TEMPLATE](https://github.com/fsantibanezleal/CAOS_PRODUCT_TEMPLATE) (a GitHub template repository) | the product skeleton on the shell, the guards, the example product, the instantiation script |
| The policy | the ADRs in the private management repository | the rules, each naming the module that implements it and the gate that measures it |

A product built on the base writes no CSS or code for the frame, the header, the icons, the tab structure, the
viewport, the areas, the text in its drawings or its numbers. If it has to, the base has a gap: the gap is fixed here
first (issue, test, CHANGELOG, release), never patched in the product (ADR-0078 section 3).

| Page | What it covers |
|---|---|
| [01 Structure](01_structure.md) | the frame and its areas, the three route types, the modes, viewports and breakpoints |
| [02 Tokens](02_tokens.md) | colours of both themes (all at WCAG AA), type, space, radii, layout sizes, icons, z-order |
| [03 Navigation](03_navigation.md) | every row of links or tabs; tabs, sub-tabs, groups, rail sections; views in the URL |
| [04 Views](04_views.md) | the workbench, the surface, the document; plot cards, stages, readouts, tables |
| [05 Drawings](05_drawings.md) | `UPlotChart`, `BarChart`, the text kit and the `data-chart` contract |
| [06 Icons and numbers](06_icons-and-numbers.md) | icon sizing by context, the brand mark; numbers in the interface language |
| [07 The gate](07_gate.md) | `caos-shell-gate`: what each check measures, its options, its self-test |
| [08 Releasing](08_releasing.md) | versions, the release steps, npm, how products pin and adopt |
