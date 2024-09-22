import {importProvidersFrom, NgModule} from '@angular/core';
import {BrowserModule} from '@angular/platform-browser';

import {AppRoutingModule} from './app-routing.module';
import {AppComponent} from './app.component';
import {provideAnimationsAsync} from '@angular/platform-browser/animations/async';
import {PermissionComponent} from "./roles/permission/permission.component";
import {RoleComponent} from "./roles/role/role.component";
import {RolesComponent} from "./roles/roles.component";
import {MatToolbar, MatToolbarModule} from "@angular/material/toolbar";
import {MatButton} from "@angular/material/button";
import {MatSidenavContainer, MatSidenavContent} from "@angular/material/sidenav";
import {EditorComponent, MonacoEditorModule} from "ngx-monaco-editor-v2";
import {MatDivider} from "@angular/material/divider";
import {FormsModule} from "@angular/forms";
import {MatCard, MatCardActions, MatCardContent, MatCardHeader, MatCardModule} from "@angular/material/card";
import {MatIcon} from "@angular/material/icon";
import {MatMenuModule} from "@angular/material/menu";
import {MatFormField, MatFormFieldModule, MatLabel, MatSuffix} from "@angular/material/form-field";
import {MatInput} from "@angular/material/input";
import {HttpClient, provideHttpClient} from "@angular/common/http";

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    PermissionComponent,
    RoleComponent,
    RolesComponent,
    MatToolbarModule,
    MatMenuModule,
    MatFormFieldModule,
    MatButton,
    MatSidenavContent,
    MatSidenavContainer,
    MatDivider,
    EditorComponent,
    FormsModule,
    MonacoEditorModule.forRoot(),
    MatCardModule,
    MatIcon,
    MatFormField,
    MatInput,
    MatLabel,
    MatSuffix
  ],
  providers: [
    provideAnimationsAsync(),provideHttpClient()
  ],
  bootstrap: [AppComponent]
})
export class AppModule {
}
