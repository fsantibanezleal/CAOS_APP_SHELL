- The executive view's source notes wrap a long word explicitly (`overflow-wrap: anywhere`, as its facts and why-now
  line already do; BL-053). A long URL in a note was reported to widen a 390 px page by CAOS_Contraste BL-070; the
  overflow was not reproduced in the shell's browser test or in Contraste's build, and the rule makes the wrap explicit
  either way.
- The executive-view browser test renders the view as products do (a `DocPage` with the two `Tabs` of an
  Introduction) and adds a long-URL note case at 390 px.
