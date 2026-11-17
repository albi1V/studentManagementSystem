import { Component, forwardRef, Input } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({ selector: 'app-password-field', standalone: true, templateUrl: './password-field.component.html', styleUrl: './password-field.component.css', providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => PasswordFieldComponent), multi: true }] })
export class PasswordFieldComponent implements ControlValueAccessor {
  @Input() label = 'Password';
  @Input() placeholder = 'Enter your password';
  @Input() inputId = 'password';
  @Input() autocomplete = 'current-password';
  @Input() describedBy: string | null = null;
  @Input() invalid = false;
  protected value = '';
  protected disabled = false;
  protected visible = false;
  private onChange: (value: string) => void = () => {};
  protected onTouched: () => void = () => {};

  writeValue(value: string | null): void { this.value = value ?? ''; }
  registerOnChange(fn: (value: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(disabled: boolean): void { this.disabled = disabled; }
  protected toggleVisibility(): void { this.visible = !this.visible; }
  protected updateValue(value: string): void { this.value = value; this.onChange(value); }
}
