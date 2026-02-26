import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageSquare, Check, Trash2, Mail, Clock, Filter } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

function useFeedback(filter: string) {
  return useQuery({
    queryKey: ['alpha', 'feedback', filter],
    queryFn: async () => {
      let query = supabase
        .from('feedback' as any)
        .select('*')
        .order('created_at', { ascending: false });

      if (filter === 'unread') {
        query = query.eq('is_read', false);
      } else if (filter === 'read') {
        query = query.eq('is_read', true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as any[];
    },
    refetchInterval: 30_000,
  });
}

function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, isRead }: { id: string; isRead: boolean }) => {
      const { error } = await supabase
        .from('feedback' as any)
        .update({ is_read: isRead })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alpha', 'feedback'] }),
  });
}

function useDeleteFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('feedback' as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alpha', 'feedback'] });
      toast({ title: 'Feedback deleted' });
    },
  });
}

const SECTION_COLORS: Record<string, string> = {
  '🐛 Bug Report': 'bg-destructive/15 text-destructive border-destructive/30',
  '✨ Feature Request': 'bg-primary/15 text-primary border-primary/30',
  '📈 Trading & Orders': 'bg-chart-1/15 text-chart-1 border-chart-1/30',
  '🤖 Bots & Automations': 'bg-chart-2/15 text-chart-2 border-chart-2/30',
  '👥 Community & Social': 'bg-chart-3/15 text-chart-3 border-chart-3/30',
  '💬 General Feedback': 'bg-muted text-muted-foreground border-border',
};

export function FeedbackTab() {
  const [filter, setFilter] = useState('all');
  const { data: feedback, isLoading } = useFeedback(filter);
  const markRead = useMarkRead();
  const deleteFeedback = useDeleteFeedback();

  const unreadCount = feedback?.filter(f => !f.is_read).length || 0;

  return (
    <div className="space-y-6">
      {/* Header with filter */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                User Feedback
                {unreadCount > 0 && (
                  <Badge variant="destructive" className="text-xs px-1.5 py-0">
                    {unreadCount} new
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="mt-1">
                Feedback submitted by users through the app
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="unread">Unread</SelectItem>
                  <SelectItem value="read">Read</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Feedback list */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      ) : !feedback || feedback.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
            <p className="text-muted-foreground">No feedback yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {feedback.map((item: any) => (
            <Card
              key={item.id}
              className={`transition-colors ${!item.is_read ? 'border-primary/30 bg-primary/[0.02]' : ''}`}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0 space-y-2">
                    {/* Top row: name, section, time */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{item.name}</span>
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${SECTION_COLORS[item.section] || ''}`}>
                        {item.section}
                      </Badge>
                      {!item.is_read && (
                        <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                      )}
                      <span className="text-xs text-muted-foreground flex items-center gap-1 ml-auto">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                      </span>
                    </div>

                    {/* Email */}
                    <a
                      href={`mailto:${item.email}`}
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 w-fit"
                    >
                      <Mail className="h-3 w-3" />
                      {item.email}
                    </a>

                    {/* Message */}
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {item.message}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => markRead.mutate({ id: item.id, isRead: !item.is_read })}
                      title={item.is_read ? 'Mark unread' : 'Mark read'}
                    >
                      <Check className={`h-4 w-4 ${item.is_read ? 'text-primary' : 'text-muted-foreground'}`} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteFeedback.mutate(item.id)}
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
