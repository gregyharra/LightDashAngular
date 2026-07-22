import { Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-api-error-banner',
  imports: [MatIconModule],
  templateUrl: './api-error-banner.component.html',
  styleUrl: './api-error-banner.component.scss',
})
export class ApiErrorBannerComponent {
  readonly message = input<string | null>(null);
  readonly severity = input<'error' | 'warning'>('error');
}
