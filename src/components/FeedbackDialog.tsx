import { useState } from 'react';
import { MessageSquarePlus, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

const SECTIONS = [
  { value: 'bug', label: '🐛 Bug Report' },
  { value: 'feature', label: '✨ Feature Request' },
  { value: 'trading', label: '📈 Trading & Orders' },
  { value: 'bots', label: '🤖 Bots & Automations' },
  { value: 'community', label: '👥 Community & Social' },
  { value: 'general', label: '💬 General Feedback' },
];

export function FeedbackDialog() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    section: '',
    message: '',
  });

  // Pre-fill when dialog opens
  const handleOpenChange = (next: boolean) => {
    if (next) {
      setForm({
        name: profile?.display_name || profile?.username || '',
        email: user?.email || '',
        section: '',
        message: '',
      });
    }
    setOpen(next);
  };

  const canSubmit = form.name.trim() && form.email.trim() && form.section && form.message.trim();

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke('send-feedback', {
        body: {
          name: form.name.trim(),
          email: form.email.trim(),
          section: SECTIONS.find(s => s.value === form.section)?.label || form.section,
          message: form.message.trim(),
        },
      });
      if (error) throw error;
      toast({ title: 'Feedback sent!', description: 'Thanks for helping us improve Cluster.' });
      setOpen(false);
    } catch (e: any) {
      toast({ title: 'Failed to send', description: e.message || 'Please try again later.', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
          <MessageSquarePlus className="h-4 w-4" />
          <span className="hidden sm:inline">Feedback</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md border-border bg-background">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <MessageSquarePlus className="h-5 w-5 text-primary" />
            Give Feedback
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            Help us make Cluster better. We read every message.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="fb-name" className="text-xs text-muted-foreground">Name</Label>
              <Input
                id="fb-name"
                placeholder="Your name"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                maxLength={100}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fb-email" className="text-xs text-muted-foreground">Email</Label>
              <Input
                id="fb-email"
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                maxLength={255}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fb-section" className="text-xs text-muted-foreground">Section</Label>
            <Select value={form.section} onValueChange={v => setForm(f => ({ ...f, section: v }))}>
              <SelectTrigger id="fb-section">
                <SelectValue placeholder="What's this about?" />
              </SelectTrigger>
              <SelectContent>
                {SECTIONS.map(s => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fb-message" className="text-xs text-muted-foreground">Message</Label>
            <Textarea
              id="fb-message"
              placeholder="Tell us what's on your mind..."
              className="min-h-[100px] resize-none"
              value={form.message}
              onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
              maxLength={2000}
            />
            <p className="text-[11px] text-muted-foreground text-right">{form.message.length}/2000</p>
          </div>

          <Button
            className="w-full gap-2"
            disabled={!canSubmit || sending}
            onClick={handleSubmit}
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {sending ? 'Sending…' : 'Send Feedback'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
