import { batchWrite, db, logAnalyticsEvent } from './firebase';
import { Event, BulkOperation } from '../types';
import { collection, deleteDoc, doc } from 'firebase/firestore';

export class BatchOperationManager {
  private operations: Map<string, BulkOperation> = new Map();

  async bulkDeleteEvents(eventIds: string[]): Promise<void> {
    const operationId = this.createOperation('delete', eventIds);
    
    try {
      this.updateOperationStatus(operationId, 'in-progress');
      
      // Delete events in batches
      const eventsToDelete = eventIds.map(id => ({ id }));
      await batchWrite('events', eventsToDelete, 'delete');
      
      // Delete associated preparation items
      for (let i = 0; i < eventIds.length; i++) {
        const eventId = eventIds[i];
        this.updateOperationProgress(operationId, (i / eventIds.length) * 100);
        
        // Note: In a real implementation, you'd want to batch delete subcollection items too
        // For now, we'll rely on Firestore security rules or a cloud function to handle cleanup
      }
      
      this.updateOperationStatus(operationId, 'completed');
      logAnalyticsEvent('bulk_delete_events', { count: eventIds.length });
    } catch (error) {
      this.updateOperationStatus(operationId, 'failed', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  async bulkUpdateEvents(eventIds: string[], updates: Partial<Event>): Promise<void> {
    const operationId = this.createOperation('update', eventIds, updates);
    
    try {
      this.updateOperationStatus(operationId, 'in-progress');
      
      const eventsToUpdate = eventIds.map(id => ({ id, ...updates }));
      await batchWrite('events', eventsToUpdate, 'update');
      
      this.updateOperationStatus(operationId, 'completed');
      logAnalyticsEvent('bulk_update_events', { 
        count: eventIds.length,
        fields: Object.keys(updates)
      });
    } catch (error) {
      this.updateOperationStatus(operationId, 'failed', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  async exportEvents(eventIds: string[], events: Event[]): Promise<void> {
    const operationId = this.createOperation('export', eventIds);
    
    try {
      this.updateOperationStatus(operationId, 'in-progress');
      
      const filteredEvents = events.filter(event => eventIds.includes(event.id));
      const csvContent = this.convertToCSV(filteredEvents);
      
      // Download CSV
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `events_export_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      
      this.updateOperationStatus(operationId, 'completed');
      logAnalyticsEvent('export_events', { count: eventIds.length });
    } catch (error) {
      this.updateOperationStatus(operationId, 'failed', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  private createOperation(
    type: BulkOperation['type'],
    eventIds: string[],
    updates?: Partial<Event>
  ): string {
    const id = `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const operation: BulkOperation = {
      type,
      eventIds,
      updates,
      status: 'pending',
      progress: 0
    };
    
    this.operations.set(id, operation);
    return id;
  }

  private updateOperationStatus(
    id: string,
    status: BulkOperation['status'],
    error?: string
  ): void {
    const operation = this.operations.get(id);
    if (operation) {
      operation.status = status;
      operation.error = error;
      this.operations.set(id, operation);
    }
  }

  private updateOperationProgress(id: string, progress: number): void {
    const operation = this.operations.get(id);
    if (operation) {
      operation.progress = progress;
      this.operations.set(id, operation);
    }
  }

  private convertToCSV(events: Event[]): string {
    if (events.length === 0) return '';
    
    const headers = ['ID', '開始日', '終了日', '地域', '部署', 'タイプ', '会場', 'クライアント', '備考'];
    const csvRows = [headers.join(',')];
    
    events.forEach(event => {
      const row = [
        event.id,
        event.start,
        event.end,
        event.region,
        event.dept,
        event.type,
        event.venue,
        event.client,
        `"${event.note.replace(/"/g, '""')}"`
      ];
      csvRows.push(row.join(','));
    });
    
    return '\uFEFF' + csvRows.join('\n'); // Add BOM for proper UTF-8 encoding in Excel
  }

  getOperation(id: string): BulkOperation | undefined {
    return this.operations.get(id);
  }

  getAllOperations(): BulkOperation[] {
    return Array.from(this.operations.values());
  }
}

export const batchManager = new BatchOperationManager();