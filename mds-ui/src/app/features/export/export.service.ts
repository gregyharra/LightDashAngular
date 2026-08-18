import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { LightdashApiService } from '../../core/api/lightdash-api.service';
import {
  ExportCreateResult,
  ExportPollResult,
  ExportRequestBody,
} from './export.models';

@Injectable({ providedIn: 'root' })
export class ExportService {
  private readonly api = inject(LightdashApiService);

  create(projectUuid: string, body: ExportRequestBody): Observable<ExportCreateResult> {
    return this.api.post<ExportCreateResult>(
      `/projects/${projectUuid}/exports`,
      body,
      { apiVersion: 'v2' },
    );
  }

  poll(projectUuid: string, exportUuid: string): Observable<ExportPollResult> {
    return this.api.get<ExportPollResult>(
      `/projects/${projectUuid}/exports/${exportUuid}`,
      { apiVersion: 'v2' },
    );
  }

  fileUrl(projectUuid: string, exportUuid: string): string {
    return `/api/v2/projects/${projectUuid}/exports/${exportUuid}/file`;
  }

  startBrowserDownload(fileUrl: string): void {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = fileUrl;
    document.body.appendChild(iframe);
    window.setTimeout(() => iframe.remove(), 60_000);
  }
}
