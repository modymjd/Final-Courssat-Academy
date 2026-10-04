import React from 'react';
import Layout from '@/components/layout/Layout';
import { useNotifications, useMarkAllNotificationsRead, useMarkNotificationRead } from '@/features/notifications';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Check, CheckCircle2, Bell } from 'lucide-react';

const NotificationsPage = () => {
  const { data, isLoading } = useNotifications();
  const { mutate: markAllRead, isPending: isMarkingAll } = useMarkAllNotificationsRead();
  const { mutate: markRead } = useMarkNotificationRead();

  return (
    <Layout>
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell size={24} className="text-primary" />
            الإشعارات
          </h1>
          {data?.unreadCount && data.unreadCount > 0 ? (
            <Button 
              variant="outline" 
              onClick={() => markAllRead()} 
              disabled={isMarkingAll}
              className="gap-2"
            >
              <Check size={16} />
              تحديد الكل كمقروء
            </Button>
          ) : null}
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : !data || data.data.length === 0 ? (
          <div className="text-center py-16 bg-muted/30 rounded-lg">
            <Bell size={48} className="mx-auto text-muted-foreground mb-4 opacity-20" />
            <h3 className="text-xl font-medium mb-2">لا توجد إشعارات</h3>
            <p className="text-muted-foreground">أنت على اطلاع بكل جديد.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {data.data.map(notification => (
              <Card 
                key={notification.id} 
                className={`transition-colors ${!notification.isRead ? 'bg-primary/5 border-primary/20' : ''}`}
              >
                <CardContent className="p-4 sm:p-6 flex gap-4">
                  <div className="mt-1 shrink-0">
                    {!notification.isRead ? (
                      <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                    ) : (
                      <CheckCircle2 size={16} className="text-muted-foreground mt-1" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                      <h3 className="font-semibold text-lg">{notification.title}</h3>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {notification.createdAt}
                      </span>
                    </div>
                    <p className="text-muted-foreground mb-3">{notification.message}</p>
                    
                    <div className="flex items-center justify-between mt-4">
                      {notification.actionUrl && (
                        <Button variant="link" className="p-0 h-auto" asChild>
                          <a href={notification.actionUrl}>عرض التفاصيل</a>
                        </Button>
                      )}
                      
                      {!notification.isRead && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => markRead(notification.id)}
                          className="ms-auto"
                        >
                          تحديد كمقروء
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default NotificationsPage;
