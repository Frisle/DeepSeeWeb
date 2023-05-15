import {Component, EventEmitter, forwardRef, HostBinding, Input, Output} from '@angular/core';
import {ControlValueAccessor, NG_VALUE_ACCESSOR} from "@angular/forms";

@Component({
    selector: 'dsw-input',
    templateUrl: './input.component.html',
    styleUrls: ['./input.component.scss'],
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef(() => InputComponent),
            multi: true
        }
    ]
})
export class InputComponent implements ControlValueAccessor {
    @Input() model: string;
    @HostBinding('class.choose')
    @Input() chooseButton = false;
    @Output() choose = new EventEmitter<void>();

    constructor() {}

    onChange = (_) => { };
    onTouched = () => { };

    writeValue(value: any): void {
        this.model = value;
    }
    registerOnChange(fn: any): void {
        this.onChange = fn;
    }
    registerOnTouched(fn: any): void {
        this.onTouched = fn;
    }
    setDisabledState?(isDisabled: boolean): void {
       return;
    }

    onSelectButtonClick() {
        this.choose.emit();
    }
}
