import { Children, Fragment, forwardRef, isValidElement, useImperativeHandle, useLayoutEffect, useRef, useState, type ReactNode, type RefObject, type SelectHTMLAttributes } from 'react';

export type NativeSelectProps = SelectHTMLAttributes<HTMLSelectElement>;

function textOf(value: ReactNode): string {
  return Children.toArray(value).map(node => typeof node === 'string' || typeof node === 'number' ? String(node) : isValidElement<{children?: ReactNode}>(node) ? textOf(node.props.children) : '').join('');
}
function optionsOf(value: ReactNode, disabled = false): {value:string;label:string;disabled:boolean}[] {
  return Children.toArray(value).flatMap(node => {
    if (!isValidElement<{children?:ReactNode;value?:string|number;label?:string;disabled?:boolean}>(node)) return [];
    if (node.type === 'option') { const text=textOf(node.props.children); return [{value:String(node.props.value ?? text),label:node.props.label ?? text,disabled:disabled || !!node.props.disabled}]; }
    return node.type === Fragment || node.type === 'optgroup' ? optionsOf(node.props.children, disabled || !!node.props.disabled) : [];
  });
}

// Local mirror state never rerenders the select. In particular, a native form reset must not
// incidentally reapply a controlled value merely because the visual label needs synchronizing.
function SelectedText({ native, initial, form }: { native:RefObject<HTMLSelectElement | null>; initial:string; form?:string }) {
  const [label, setLabel] = useState(initial);
  const sync = () => { const held=native.current?.selectedOptions[0]?.label ?? ''; setLabel(old => old === held ? old : held); };
  // DOM selection is authoritative, including disabled groups, unmatched values and dynamic custom option components.
  useLayoutEffect(sync);
  useLayoutEffect(() => {
    const select = native.current;
    if (!select) return;
    const observer = new MutationObserver(sync);
    observer.observe(select, {subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['label','value','disabled','selected']});
    // A native reset event precedes its default action. A task (not a microtask checkpoint inside
    // event dispatch) observes the selection after the browser has restored defaultValue.
    let resetTimer: number | undefined;
    const form = select.form, reset = () => { if (resetTimer !== undefined) window.clearTimeout(resetTimer); resetTimer = window.setTimeout(sync, 0); };
    select.addEventListener('change', sync);
    form?.addEventListener('reset', reset);
    return () => { observer.disconnect(); select.removeEventListener('change', sync); form?.removeEventListener('reset', reset); if (resetTimer !== undefined) window.clearTimeout(resetTimer); };
  }, [native, form]);
  return <span className="cs-select-text">{label}</span>;
}

/** A real native popup select with an aria-hidden, unbounded wrapping display of its held option.
 * Multi-select/listbox forms remain ordinary native controls. No options, labels, events or values are rewritten. */
export const NativeSelect = forwardRef<HTMLSelectElement, NativeSelectProps>(function NativeSelect(props, forwardedRef) {
  const {children, className, onChange, style, multiple, size, hidden, ...rest} = props;
  const native = useRef<HTMLSelectElement>(null);
  const plain = !!multiple || (size ?? 0) > 1;
  const options = optionsOf(children), held = props.value ?? props.defaultValue;
  const initial = ((held === undefined ? undefined : options.find(option => option.value === String(held))) ?? options.find(option => !option.disabled) ?? options[0])?.label ?? '';
  useImperativeHandle(forwardedRef, () => native.current!, [plain]);
  // Keep the same native node across popup/listbox changes. Replacing the root select would
  // discard an uncontrolled selection and its browser-owned dirty/default/reset state.
  return <span className={plain ? undefined : 'cs-select-wrap'} data-native-select={plain ? undefined : ''} data-native-select-plain={plain ? '' : undefined} hidden={hidden} style={plain ? {display:'contents'} : style}>
    <span className="cs-select-display" aria-hidden="true" hidden={plain}><SelectedText native={native} initial={initial} form={props.form}/></span>
    <select {...rest} hidden={hidden} multiple={multiple} size={size} className={plain ? className : ['select','cs-select-native',className].filter(Boolean).join(' ')} style={plain ? style : undefined} onChange={onChange} ref={native}>{children}</select>
  </span>;
});
