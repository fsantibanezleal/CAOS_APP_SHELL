# Validation: document surfaces

SHD-088 opts SurfacePage into document framing without changing the existing surface default.
Use the shell stylesheet and a direct AppShell child; no product CSS or outer page-body wrapper.
Static markup checks one document marker/root, tab row, and Focus control; unset and false match.
The browser fixture measures column/heading/lede/body widths and root padding at 1280x800 and
390x844 in EN/ES and light/dark. It changes view and sub-view, enters Focus, exits with Escape and
button, and checks URL state, selected sub-view and restored document framing. Generic mode keeps
its measured lede cap at desktop width. Main runs the full shell release gates after scoped checks.
