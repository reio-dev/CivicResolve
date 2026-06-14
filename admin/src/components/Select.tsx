import React, { useState, useRef, useEffect, forwardRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  options: SelectOption[];
  value?: string;
  onChange?: (e: any) => void;
  placeholder?: string;
  className?: string;
  wrapperClassName?: string;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ options, value, onChange, placeholder, className, wrapperClassName, name, ...props }, ref) => {
    const [isOpen, setIsOpen] = useState(false);
    const [internalValue, setInternalValue] = useState(value || props.defaultValue || '');
    const containerRef = useRef<HTMLDivElement>(null);
    const selectRef = useRef<HTMLSelectElement | null>(null);

    // Sync internal ref and forwarded ref
    useEffect(() => {
      if (typeof ref === 'function') {
        ref(selectRef.current);
      } else if (ref) {
        ref.current = selectRef.current;
      }
    }, [ref]);

    // Update internal state if value prop changes (e.g. from react-hook-form default values)
    useEffect(() => {
      if (value !== undefined) {
        setInternalValue(value);
      }
    }, [value]);

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (optionValue: string) => {
      setInternalValue(optionValue);
      setIsOpen(false);
      
      // Update the hidden select and trigger change for react-hook-form
      if (selectRef.current) {
        selectRef.current.value = optionValue;
        const event = new Event('change', { bubbles: true });
        selectRef.current.dispatchEvent(event);
      }
      
      if (onChange) {
        onChange({
          target: { name, value: optionValue },
          type: 'change'
        });
      }
    };

    const selectedOption = options.find((opt) => opt.value === internalValue);

    return (
      <div className={cn("relative w-full", wrapperClassName)} ref={containerRef}>
        {/* Hidden native select for form libraries like react-hook-form */}
        <select
          className="hidden"
          ref={selectRef}
          name={name}
          value={internalValue}
          onChange={(e) => {
            setInternalValue(e.target.value);
            if (onChange) onChange(e);
          }}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* Custom UI trigger */}
        <button
          type="button"
          onClick={() => !props.disabled && setIsOpen(!isOpen)}
          className={cn(
            'flex items-center justify-between w-full rounded-lg border border-gray-200/50 dark:border-zinc-800/50 bg-white/50 dark:bg-black/40 backdrop-blur-md px-4 py-2.5 text-sm md:text-base text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all',
            props.disabled && 'opacity-50 cursor-not-allowed',
            className
          )}
        >
          <span className="truncate">
            {selectedOption ? selectedOption.label : (placeholder || 'Select an option')}
          </span>
          <ChevronDown
            className={cn('h-4 w-4 ml-2 opacity-50 transition-transform duration-200', isOpen && 'rotate-180')}
          />
        </button>

        {/* Custom UI dropdown */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              className="absolute z-50 w-full mt-2 rounded-lg border border-gray-200/50 dark:border-zinc-800/50 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl shadow-lg overflow-hidden py-1 max-h-60 overflow-y-auto scrollbar-hide"
            >
              {placeholder && (
                <div
                  className="px-4 py-2 text-sm md:text-base text-gray-500 hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer transition-colors"
                  onClick={() => handleSelect('')}
                >
                  {placeholder}
                </div>
              )}
              {options.map((option) => (
                <div
                  key={option.value}
                  className={cn(
                    'px-4 py-2 text-sm md:text-base cursor-pointer transition-colors',
                    internalValue === option.value
                      ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium'
                      : 'text-gray-900 dark:text-gray-100 hover:bg-black/5 dark:hover:bg-white/10'
                  )}
                  onClick={() => handleSelect(option.value)}
                >
                  {option.label}
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }
);

Select.displayName = 'Select';
export default Select;
