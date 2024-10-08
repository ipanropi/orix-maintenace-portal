import { Component, OnInit, Input, ElementRef, ViewChild, AfterViewInit,OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { format, addMinutes, startOfDay, differenceInMinutes } from 'date-fns';

interface Event {
  startTime: string;
  endTime: string;
  marshal: string;
  ticketId: string;
}
interface ProcessedEvent {
  event: Event;
  column: number;
  width: number;
  left: number;
}
@Component({
  selector: 'app-day-view',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './calendar-day-view.component.html',
  styleUrl: './calendar-day-view.component.css',
})
export class CalendarDayViewComponent implements OnInit, OnChanges, AfterViewInit {
  @Input() date: Date = new Date();
  @Input() events: { [key: string]: Event[] } = {}; // Keyed by date in 'M/d' format
  @ViewChild('container', { static: true }) containerRef!: ElementRef;
  hours: string[] = [];
  minutes: string[] = ['00', '15', '30', '45'];
  startHour: number = 8;
  endHour: number = 18;
  currentTimePosition: number = 0;
  processedEvents: ProcessedEvent[] = [];
  maxColumns: number = 4; // Set maximum columns to 2 for example
  overflowedEvents: { [key: string]: Event[] } = {}; // Store overflowed events
  activeOverflowSlot: string | null = null;
  detail: Event | null = null;
  popoverPosition = { top: 0, right: 0 };

  constructor(private elementRef: ElementRef) {}

  ngOnInit() {
    this.initializeComponent();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['date'] || changes['events']) {
      this.initializeComponent();
    }
  }

  initializeComponent() {
    this.generateHours();
    this.updateCurrentTimeLine();
    setInterval(() => this.updateCurrentTimeLine(), 60000); // Update every minute
    this.processEvents();
  }

  ngAfterViewInit() {
    // The view is now initialized, you can safely use containerRef
  }

  generateHours() {
    this.hours = Array.from(
      { length: this.endHour - this.startHour },
      (_, i) => (i + this.startHour).toString()
    );
  }

  updateCurrentTimeLine() {
    const now = new Date();
    const dayStart = startOfDay(this.date);
    var minutesSinceDayStart = differenceInMinutes(now, dayStart);
    if(minutesSinceDayStart/60>this.endHour){
      minutesSinceDayStart=this.endHour*60;
    }else if(minutesSinceDayStart/60<this.startHour){
      minutesSinceDayStart=this.startHour*60;
    }
    this.currentTimePosition = (minutesSinceDayStart / 60-this.startHour) * 180; // 60px per hour
  }

  format(date: Date, formatString: string): string {
    return format(date, formatString);
  }

  timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }
  processEvents() {
    if(this.events[format(this.date,'M/d')]){
      const sortedEvents = this.events[format(this.date,'M/d')].sort((a, b) => 
        this.timeToMinutes(a.startTime) - this.timeToMinutes(b.startTime) ||
        this.timeToMinutes(b.endTime) - this.timeToMinutes(a.endTime)
      );
    
      let columns: ProcessedEvent[][] = [];
      this.overflowedEvents = {}; // Reset overflowed events
    
      sortedEvents.forEach(event => {
        let columnIndex = 0;
        let placedEvent: ProcessedEvent | null = null;
    
        while (!placedEvent && columnIndex < this.maxColumns) {
          if (!columns[columnIndex]) {
            columns[columnIndex] = [];
          }
    
          const conflictingEvent = columns[columnIndex].find(existingEvent => 
            this.overlaps(existingEvent.event, event)
          );
    
          if (!conflictingEvent) {
            placedEvent = { event, column: columnIndex, width: 1, left: columnIndex };
            columns[columnIndex].push(placedEvent);
          } else {
            columnIndex++;
          }
        }
    
        if (!placedEvent) {
          const timeSlotKey = `${event.startTime}-${event.endTime}`;
          if (!this.overflowedEvents[timeSlotKey]) {
            this.overflowedEvents[timeSlotKey] = [];
          }
          this.overflowedEvents[timeSlotKey].push(event);
        }
      });
    
      // Adjust widths and positions
      this.processedEvents = columns.flat().map(event => {
        const colSpan = this.getColumnSpan(event, columns);
        return {
          ...event,
          width: colSpan*2.5,
          left: event.column / columns.length
        };
      });
    }
  }
  
  getColumnSpan(event: ProcessedEvent, columns: ProcessedEvent[][]): number {
    let span = 1;
    const startCol = event.column;
  
    for (let i = startCol + 1; i < columns.length; i++) {
      if (columns[i].some(e => this.overlaps(e.event, event.event))) {
        break;
      }
      span++;
    }
  
    return span;
  }
  
  getEventStyle(eventData: ProcessedEvent) {
    const start = this.timeToMinutes(eventData.event.startTime) - this.startHour * 60;
    const end = this.timeToMinutes(eventData.event.endTime) - this.startHour * 60;

    const top = start * 3; // Each minute is 3px
    const height = (end - start) * 3; // Duration in minutes multiplied by 3

    // Calculate the number of columns for the specific time slot
    var totalColumns = this.getTotalColumnsForTimeRange(eventData.event.startTime, eventData.event.endTime);
    var width;
    var left;
    if(totalColumns>this.maxColumns){
      totalColumns=this.maxColumns*2+1;

      width = `${(2 / totalColumns) * 95}%`;
      left = `${(2*eventData.column / totalColumns) * 100}%`;
    }else{
      width = `${(1 / totalColumns) * 95}%`;
      left = `${(eventData.column / totalColumns) * 100}%`;
    }

    return {
        top: `${top}px`,
        height: `${height}px`,
        width: width,
        left: left,
    };
}

getTotalColumnsForTimeRange(startTime: string, endTime: string): number {
  let maxColumns = 1;

  this.processedEvents.forEach(event => {
      if (this.overlaps(event.event, { startTime, endTime, marshal: '', ticketId: '' })) {
          maxColumns = Math.max(maxColumns, event.column + 1);
          const timeSlotKey = `${event.event.startTime}-${event.event.endTime}`;
          if (this.overflowedEvents[timeSlotKey] && this.overflowedEvents[timeSlotKey].length > 0) {
              maxColumns += 1; // Add one more column to account for overflow
          }
      }
  });



  return maxColumns;
}

  overlaps(event1: Event, event2: Event): boolean {
    return this.timeToMinutes(event1.startTime) < this.timeToMinutes(event2.endTime) &&
           this.timeToMinutes(event2.startTime) < this.timeToMinutes(event1.endTime);
  }
  getOverflowKeys(): string[] {
    return Object.keys(this.overflowedEvents);
  }
  getOverflowStyle(timeSlot: string) {
    const [startTime] = timeSlot.split('-');
    const start = this.timeToMinutes(startTime) - this.startHour * 60;
    const top = start * 3; // Each minute is 3px

    var column = this.maxColumns*2 + 1;
    const width = `${(1 / column) * 95}%`;


    return {
      top: `${top}px`,
      height: `45px`,
      width: width,
    };
  }
  showOverflow(timeSlot: string) {
    this.activeOverflowSlot = timeSlot;
    console.log(this.overflowedEvents[timeSlot])
  }
  
  hideOverflow() {
    this.activeOverflowSlot = null;
  }

  showDetail(event: MouseEvent, timeSlot: Event) {
    // console.log('ElementRef:', this.elementRef);
    // console.log('Event target:', event.target);
    if (this.elementRef && this.elementRef.nativeElement) {
    
      const containerRect = this.elementRef.nativeElement.getBoundingClientRect();

      // Calculate the top position relative to the container based on the mouse's Y coordinate
      const top = event.clientY - containerRect.top - 20;
      const right = containerRect.right - event.clientX - 30;//60 for padding
    this.popoverPosition = {
      top: top,
      right: right,
    };
  
    this.detail = timeSlot;
  } else {
    console.error('ElementRef or nativeElement is undefined');
  }
}
  hideDetail() {
    this.detail = null;
  }
}