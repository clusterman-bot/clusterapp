import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Image, BarChart3, Smile, MapPin, CalendarDays, 
  Code, LineChart, Send
} from 'lucide-react';
import { useProfile } from '@/hooks/useProfile';
import { useUserRole } from '@/hooks/useUserRole';
import { useCreatePost } from '@/hooks/useSocial';
import { useToast } from '@/hooks/use-toast';

interface CreatePostBoxProps {
  onPostCreated?: () => void;
  placeholder?: string;
}

export function CreatePostBox({ onPostCreated, placeholder }: CreatePostBoxProps) {
  const { data: profile } = useProfile();
  const { data: userRole } = useUserRole();
  const createPost = useCreatePost();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [content, setContent] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const isDeveloper = userRole?.role === 'developer';
  const maxChars = 500;
  const charsRemaining = maxChars - content.length;

  const handleSubmit = async () => {
    if (!content.trim()) return;

    try {
      await createPost.mutateAsync({
        content,
        post_type: isDeveloper ? 'model_update' : 'update',
      });
      setContent('');
      setIsFocused(false);
      toast({ title: 'Posted!', description: 'Your post is now live' });
      onPostCreated?.();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  return (
    <Card className="border-b rounded-none border-x-0 border-t-0">
      <CardContent className="pt-4 pb-2 px-4">
        <div className="flex gap-3">
          {/* Avatar */}
          <Avatar 
            className="h-11 w-11 cursor-pointer"
            onClick={() => navigate('/profile')}
          >
            <AvatarImage src={profile?.avatar_url || undefined} />
            <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-semibold">
              {profile?.display_name?.[0] || profile?.username?.[0] || '?'}
            </AvatarFallback>
          </Avatar>

          {/* Input Area */}
          <div className="flex-1">
            <Textarea
              placeholder={placeholder || (isDeveloper ? "Share a model update..." : "What's happening?")}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onFocus={() => setIsFocused(true)}
              className={`min-h-[60px] resize-none border-0 bg-transparent p-0 text-lg placeholder:text-muted-foreground/60 focus-visible:ring-0 focus-visible:ring-offset-0 ${
                isFocused ? 'min-h-[100px]' : ''
              }`}
              maxLength={maxChars}
            />

            {/* Expanded view when focused */}
            {(isFocused || content.length > 0) && (
              <>
                <Separator className="my-3" />
                
                <div className="flex items-center justify-between">
                  {/* Action Icons */}
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-primary hover:bg-primary/10">
                      <Image className="h-5 w-5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-primary hover:bg-primary/10">
                      <BarChart3 className="h-5 w-5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-primary hover:bg-primary/10">
                      <Smile className="h-5 w-5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-primary hover:bg-primary/10">
                      <CalendarDays className="h-5 w-5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-primary hover:bg-primary/10">
                      <MapPin className="h-5 w-5" />
                    </Button>
                  </div>

                  {/* Right side */}
                  <div className="flex items-center gap-3">
                    {/* Character count */}
                    {content.length > 0 && (
                      <span className={`text-sm ${charsRemaining < 50 ? 'text-orange-500' : 'text-muted-foreground'}`}>
                        {charsRemaining}
                      </span>
                    )}
                    
                    {/* Role indicator */}
                    <Badge variant="outline" className="text-xs">
                      {isDeveloper ? (
                        <>
                          <Code className="h-3 w-3 mr-1" />
                          Developer
                        </>
                      ) : (
                        <>
                          <LineChart className="h-3 w-3 mr-1" />
                          Trader
                        </>
                      )}
                    </Badge>

                    {/* Post button */}
                    <Button 
                      onClick={handleSubmit}
                      disabled={!content.trim() || createPost.isPending}
                      className="rounded-full px-5"
                    >
                      {createPost.isPending ? 'Posting...' : 'Post'}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
