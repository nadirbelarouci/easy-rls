import {Component, Input, input, OnInit, viewChildren} from '@angular/core';
import {MatAccordion} from "@angular/material/expansion";
import {PermissionComponent} from "../permission/permission.component";

@Component({
  selector: 'app-role',
  standalone: true,
  imports: [
    MatAccordion,
    PermissionComponent
  ],
  templateUrl: './role.component.html',
  styleUrl: './role.component.css'
})
export class RoleComponent{
  role = input('');
  @Input() tables! :Set<string>;
  permissionComponents = viewChildren(PermissionComponent);

  get value() {
    const result: Record<string, any> = {};
    result[this.role()] = {
      permissions: this.permissionComponents().map(permissionComponent => permissionComponent.permissions).flat(),
      restricted_actions: this.permissionComponents().map(permissionComponent => permissionComponent.restricted_actions).flat()
    }
    return result;
  }

  get valid() {
    return this.permissionComponents().map(permissionComponent => permissionComponent.valid).every(isValid => isValid)
  }
}
