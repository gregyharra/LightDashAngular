import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AuthEntryComponent } from './app/remote-entry/entry';

bootstrapApplication(AuthEntryComponent, appConfig).catch((err) => console.error(err));
