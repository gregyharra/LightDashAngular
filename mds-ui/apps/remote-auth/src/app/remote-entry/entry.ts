import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  imports: [RouterOutlet],
  selector: 'app-auth-entry',
  template: '<router-outlet />',
})
export class AuthEntryComponent {}
