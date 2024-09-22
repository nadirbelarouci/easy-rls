import {Component, inject, OnInit} from '@angular/core';
import {
  deleteTableFromPrimaryKeys, generatePolicies,
  getTableNamesFromPrimaryKeys, JsonExample, rbacSQL,
  Schema,
  SchemaQuery,
  validateRelationsAndPrimaryKeys
} from "./schema";
import {Clipboard} from "@angular/cdk/clipboard";
import {openaiPrompt} from "./openai.prompt";
import {HttpClient, HttpErrorResponse, HttpHeaders} from "@angular/common/http";
import {MatSnackBar} from "@angular/material/snack-bar";

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit{
  clipboard = inject(Clipboard);
  snackbar = inject(MatSnackBar)
  http = inject(HttpClient);
  editorOptions = {theme: 'vs-dark', language: 'sql'};
  userSchema =JsonExample;
  schema!: Schema|undefined;
  protected readonly getTableNamesFromPrimaryKeys = getTableNamesFromPrimaryKeys;
   openAIAPIKey!: string;
  sqlResponse: string ='';

  ngOnInit(): void {
    const schema = localStorage.getItem('schema');
    if (!!schema && validateRelationsAndPrimaryKeys(schema)){
      this.schema = JSON.parse(schema) as Schema;
    }
  }

  protected readonly JSON = JSON;
  protected readonly SchemaQuery = SchemaQuery;

  validateAndContinue() {
    if(this.userSchema && validateRelationsAndPrimaryKeys(this.userSchema)){
      this.schema = JSON.parse(this.userSchema) as Schema;
      localStorage.setItem('schema',this.userSchema);
    }
  }


  async generateRLS(roles: any) {
    if(!this.openAIAPIKey|| this.openAIAPIKey ===''){
      this.snackbar.open('Your Open AI API Key is not set','close',{duration:5000});
      return;
    }

    let prompt = openaiPrompt;
    prompt = prompt.replace('$1',JSON.stringify(this.schema));
    prompt = prompt.replace('$2',JSON.stringify(roles));
    const endpointUrl = 'https://yapxmkiwmeyuyhhyyrzk.supabase.co/functions/v1/easy-rls';
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'open_ai_api_key': this.openAIAPIKey
    });

    const postData = {
      prompt: prompt
    };

    this.http.post(endpointUrl, postData, { headers: headers })
      .subscribe({
        next: (response: any) => {
          this.sqlResponse = rbacSQL;
          this.sqlResponse += response.content.replace('```sql','').replace('```','')
          this.sqlResponse += generatePolicies(this.schema as any)

        },
        error: (error: HttpErrorResponse) => {
          this.snackbar.open('EasyRLS request error:', 'Close', { duration: 5000 }); // Basic error message

          if (error.error instanceof ErrorEvent) {
            // Client-side error
            this.snackbar.open('Client-side error: ' + error.error.message, 'Close', { duration: 5000 });
          } else {
            // Server-side error, handle potential OpenAI API errors
            this.snackbar.open(`Server-side error: ${error.status} - ${error.message}`, 'Close', { duration: 5000 });

            if (error.status === 400) {
              // Handle the "Prompt is required" error
              this.snackbar.open('Error details: Prompt is required', 'Close', { duration: 5000 });
            } else {
              // Handle other OpenAI API errors
              this.snackbar.open('Error details: ' + JSON.stringify(error.error), 'Close', { duration: 5000 });
            }
          }
        }
      });
  }

  setOpenAIKey(value: string) {
    this.openAIAPIKey = value;
  }

  deleteTable(table: string) {
    if (!!this.schema) {
      this.schema = deleteTableFromPrimaryKeys(this.schema, table);
      localStorage.setItem('schema', JSON.stringify(this.schema));
    }
  }

  protected readonly localStorage = localStorage;
}
