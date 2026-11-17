import { Component, input } from '@angular/core';

export type DashboardIconName =
  | 'graduation-cap' | 'layout-dashboard' | 'users-round' | 'calendar-days'
  | 'clipboard-check' | 'user-round' | 'bell' | 'chevron-down' | 'menu'
  | 'close' | 'book-open' | 'calendar-clock' | 'circle-check' | 'hourglass'
  | 'rocket' | 'eye' | 'plus' | 'calendar-plus' | 'map-pin'
  | 'arrow-right-left' | 'calendar-check' | 'globe' | 'copy';

@Component({
  selector: 'app-dashboard-icon',
  standalone: true,
  templateUrl: './dashboard-icon.component.html',
  styleUrl: './dashboard-icon.component.css',
})
export class DashboardIconComponent {
  readonly name = input.required<DashboardIconName>();
  readonly size = input(20);
}
