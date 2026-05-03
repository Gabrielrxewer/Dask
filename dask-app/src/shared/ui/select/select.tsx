import {
  Children,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactElement,
  type SelectHTMLAttributes
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/shared/lib/cn";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {}

interface SelectOption {
  disabled: boolean;
  label: string;
  value: string;
}

function getTextContent(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map(getTextContent).join("");
  }

  return "";
}

export function Select({ autoFocus, className = "", children, disabled, onChange, value, defaultValue, ...props }: SelectProps) {
  const id = useId();
  const listboxId = `${id}-listbox`;
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const nativeSelectRef = useRef<HTMLSelectElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);
  const [internalValue, setInternalValue] = useState(() =>
    value !== undefined ? String(value) : defaultValue !== undefined ? String(defaultValue) : ""
  );

  const options = useMemo<SelectOption[]>(() => {
    return Children.toArray(children).flatMap(child => {
      if (!isValidElement(child) || child.type !== "option") {
        return [];
      }

      const option = child as ReactElement<{
        children?: unknown;
        disabled?: boolean;
        value?: string | number;
      }>;

      const label = getTextContent(option.props.children);
      return [
        {
          disabled: Boolean(option.props.disabled),
          label,
          value: option.props.value !== undefined ? String(option.props.value) : label
        }
      ];
    });
  }, [children]);

  const selectedValue = value !== undefined ? String(value) : internalValue;
  const selectedOption = options.find(option => option.value === selectedValue) ?? options.find(option => !option.disabled);

  useEffect(() => {
    if (value !== undefined) {
      setInternalValue(String(value));
    }
  }, [value]);

  useEffect(() => {
    if (autoFocus) {
      buttonRef.current?.focus();
    }
  }, [autoFocus]);

  const updateMenuPosition = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) {
      setMenuStyle(null);
      return;
    }

    const gap = 4;
    const viewportPadding = 12;
    const availableWidth = Math.max(0, window.innerWidth - viewportPadding * 2);
    const menuWidth = Math.min(Math.max(rect.width, 260), availableWidth);
    const left = Math.min(Math.max(viewportPadding, rect.left), window.innerWidth - viewportPadding - menuWidth);
    const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
    const spaceAbove = rect.top - viewportPadding;
    const openUp = spaceBelow < 160 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(120, Math.min(280, openUp ? spaceAbove - gap : spaceBelow - gap));

    setMenuStyle({
      position: "fixed",
      left,
      top: openUp ? undefined : rect.bottom + gap,
      bottom: openUp ? window.innerHeight - rect.top + gap : undefined,
      width: menuWidth,
      maxHeight,
      zIndex: 10050
    });
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!buttonRef.current?.parentElement?.contains(target) && !menuRef.current?.contains(target)) {
        setIsOpen(false);
      }
    };

    updateMenuPosition();
    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [isOpen, updateMenuPosition]);

  function emitChange(nextValue: string) {
    if (nativeSelectRef.current) {
      nativeSelectRef.current.value = nextValue;
      onChange?.({
        target: nativeSelectRef.current,
        currentTarget: nativeSelectRef.current
      } as ChangeEvent<HTMLSelectElement>);
    }
  }

  function selectOption(option: SelectOption) {
    if (option.disabled || disabled) {
      return;
    }

    if (value === undefined) {
      setInternalValue(option.value);
    }

    emitChange(option.value);
    setIsOpen(false);
    buttonRef.current?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) {
      return;
    }

    const enabledOptions = options.filter(option => !option.disabled);
    const currentIndex = enabledOptions.findIndex(option => option.value === selectedValue);

    if (event.key === "Escape") {
      setIsOpen(false);
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setIsOpen(current => !current);
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      const nextIndex =
        currentIndex < 0
          ? 0
          : (currentIndex + direction + enabledOptions.length) % enabledOptions.length;
      const nextOption = enabledOptions[nextIndex];

      if (nextOption) {
        if (!isOpen) {
          setIsOpen(true);
        }
        selectOption(nextOption);
      }
    }
  }

  return (
    <div className={cn("shared-select", isOpen ? "shared-select--open" : "", disabled ? "shared-select--disabled" : "", className)}>
      <select
        ref={nativeSelectRef}
        className="shared-select__native"
        disabled={disabled}
        value={selectedValue}
        tabIndex={-1}
        aria-hidden="true"
        onChange={onChange}
        {...props}
      >
        {children}
      </select>

      <button
        ref={buttonRef}
        type="button"
        className="shared-select__control"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        onClick={() => setIsOpen(current => !current)}
        onKeyDown={handleKeyDown}
      >
        <span className={selectedOption?.label ? "shared-select__value" : "shared-select__value shared-select__value--muted"}>
          {selectedOption?.label || "Selecione"}
        </span>
        <span className="shared-select__chevron" aria-hidden="true" />
      </button>

      {isOpen && menuStyle ? createPortal(
        <div
          ref={menuRef}
          className="shared-select__menu shared-select__menu--portal"
          id={listboxId}
          role="listbox"
          style={menuStyle}
        >
          {options.map(option => (
            <button
              key={`${option.value}-${option.label}`}
              type="button"
              className={cn(
                "shared-select__option",
                option.value === selectedValue ? "shared-select__option--selected" : ""
              )}
              disabled={option.disabled}
              role="option"
              aria-selected={option.value === selectedValue}
              onClick={() => selectOption(option)}
            >
              <span>{option.label}</span>
            </button>
          ))}
        </div>,
        document.body
      ) : null}
    </div>
  );
}
