import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { LightdashApiService } from '../../core/api/lightdash-api.service';
import { AiChatRequest, AiChatResponse } from '../../core/models/ai.model';

@Injectable({ providedIn: 'root' })
export class AiAssistantService {
  private readonly api = inject(LightdashApiService);

  chat(projectUuid: string, payload: AiChatRequest): Observable<AiChatResponse> {
    return this.api.post<AiChatResponse>(
      `/projects/${projectUuid}/ai/chat`,
      payload,
    );
  }
}
