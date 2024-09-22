import {Component, Input, OnInit} from '@angular/core';
import {FormBuilder, FormGroup, FormControl, Validators, ReactiveFormsModule} from '@angular/forms';
import {MatExpansionModule} from '@angular/material/expansion';
import {MatFormFieldModule} from "@angular/material/form-field";
import {NgForOf, NgIf, TitleCasePipe} from "@angular/common";
import {MatInput} from "@angular/material/input";
import {MatIcon} from "@angular/material/icon";
import {MatCheckbox} from "@angular/material/checkbox";

interface Permission {
  resource: string;
  action: string;
  description: string;
}

@Component({
  selector: 'app-permission',
  standalone: true,
  imports: [MatExpansionModule, ReactiveFormsModule, MatFormFieldModule, NgIf, NgForOf, MatInput, MatIcon, MatCheckbox, TitleCasePipe],
  templateUrl: './permission.component.html',
  styleUrls: ['./permission.component.scss']
})
export class PermissionComponent implements OnInit {
  @Input() resource!: string;
  @Input() role!: string;
  form!: FormGroup;
  actions = ['select', 'update', 'insert', 'delete'];
  indeterminate: boolean = false;
  allSelected: boolean = false;

  constructor(private fb: FormBuilder) {
  }

  ngOnInit() {

    this.form = this.fb.group({
      select: [false, []],
      insert: [false, []],
      update: [false, []],
      delete: [false, []],
      description: [''],
      selectDescription: ['',],
      updateDescription: ['',],
      insertDescription: ['',],
      deleteDescription: ['',]
    });

    (this.form.get('description') as FormControl).valueChanges.subscribe(value => {
        this.actions.forEach(action => this.form.get(action + 'Description')?.setValue(value))
      }
    )

    const rolesJson = localStorage.getItem('roles')
    if (!!rolesJson) {
      const roles = JSON.parse(rolesJson);
      if (roles[this.role] && roles[this.role].permissions && Array.isArray(roles[this.role].permissions)) {

        const permissions = (roles[this.role].permissions as {
          action: string,
          resource: string,
          description: string
        }[]).filter(value => value.resource === this.resource);
        permissions.forEach(value => {
          this.checkAction(value.action, true)
          this.form.get(value.action + 'Description')?.setValue(value.description)
        });

        if (this.hasSameDescription(permissions.map(value => value.description))) {
          this.form.get('description')?.setValue(permissions[0].description)
        }
      }
    }
  }

  hasSameDescription<T>(list: T[]): boolean {
    if (list.length === 0) {
      return false;
    }

    const uniqueElements = new Set(list);
    return uniqueElements.size === 1;
  }

  checkAction(action: string, checked: boolean) {
    this.form.get(action)?.setValue(checked);
    const selectedActions = this.actions.filter(action => this.form.get(action)?.value === true).length;
    this.allSelected = selectedActions === this.actions.length
    this.indeterminate = selectedActions > 0 && selectedActions !== this.actions.length;
    if (checked) {
      this.form.get(action + 'Description')?.setValidators([Validators.required]);
    } else {
      this.form.get(action + 'Description')?.clearValidators();
    }
  }

  updateAllActions(checked: boolean) {
    this.actions.forEach(action => this.form.get(action)?.setValue(checked));
  }

  get permissions() {
    return this.actions.filter(action => this.form.get(action)?.value === true).map(action => ({
      resource: this.resource,
      action: action,
      description: this.form.get(action + 'Description')?.value
    }))
  }

  get restricted_actions() {
    return this.actions.filter(action => this.form.get(action)?.value === false).map(action => ({
      resource: this.resource,
      action: action
    }))
  }

  get valid() {
    this.form.markAllAsTouched()
    return this.form.valid
  }
}
