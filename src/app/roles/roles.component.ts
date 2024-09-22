import {Component, EventEmitter, Input, input, OnInit, Output, output, viewChildren} from '@angular/core';
import {MatTab, MatTabGroup, MatTabLabel} from "@angular/material/tabs";
import {RoleComponent} from "./role/role.component";
import {MatButton, MatIconButton} from "@angular/material/button";
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import {MatError, MatFormField, MatLabel, MatSuffix} from "@angular/material/form-field";
import {MatIcon} from "@angular/material/icon";
import {MatInput} from "@angular/material/input";
import {NgIf, TitleCasePipe} from "@angular/common";
import {EditorComponent} from "ngx-monaco-editor-v2";
import {interval} from "rxjs";
import {MatChip, MatChipSet, MatChipsModule} from "@angular/material/chips";

@Component({
  selector: 'app-roles',
  standalone: true,
  imports: [
    MatTabGroup,
    MatTab,
    RoleComponent,
    MatButton,
    FormsModule,
    MatError,
    MatFormField,
    MatIcon,
    MatInput,
    MatLabel,
    MatSuffix,
    NgIf,
    ReactiveFormsModule,
    TitleCasePipe,
    MatIconButton,
    MatTabLabel,
    EditorComponent,
    MatChipsModule
  ],
  templateUrl: './roles.component.html',
  styleUrl: './roles.component.css'
})
export class RolesComponent implements OnInit{
  roles = new Set([] as string[]);
  @Input() tables! :Set<string>;
  clearEvent = output();
  generateEvent = output<any>();
  deleteTableEvent = output<string>();
  roleComponents = viewChildren(RoleComponent);
  saveInterval = interval(2000)

  ngOnInit(): void {
    const roles = localStorage.getItem('roles');
    if (!!roles){
      this.roles = new Set(Object.keys(JSON.parse(roles)));
    }
    this.saveInterval.subscribe(() => {
      localStorage.setItem('roles', JSON.stringify(this.value))
    })
  }


  get value() {
    return this.roleComponents().map(roleComponent => roleComponent.value)
      .reduce((merged, current) => ({...merged, ...current}), {});
  }

  get valid() {
    return this.roleComponents().map(roleComponent => roleComponent.valid).every(isValid => isValid)

  }

  addRole(role: string) {
    if (!this.roles.has(role.toLowerCase())) {
      this.roles.add(role.toLowerCase())
    }
  }

  removeRole(role: string) {
    this.roles.delete(role);
  }

  submit() {
    console.log("whaat")

    if(this.valid){
      this.generateEvent.emit(this.value);
    }
  }

  clear() {
    localStorage.clear();
    this.roles = new Set();
    this.clearEvent.emit();
  }

  deleteTable(table: string) {
    this.deleteTableEvent.emit(table);
  }
}
