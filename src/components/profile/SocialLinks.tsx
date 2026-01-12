import { Twitter, Linkedin, Github, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SocialLinksProps {
  twitterHandle?: string | null;
  linkedinUrl?: string | null;
  githubHandle?: string | null;
  websiteUrl?: string | null;
}

export function SocialLinks({ 
  twitterHandle, 
  linkedinUrl, 
  githubHandle, 
  websiteUrl 
}: SocialLinksProps) {
  const hasAnySocial = twitterHandle || linkedinUrl || githubHandle || websiteUrl;
  
  if (!hasAnySocial) return null;

  return (
    <div className="flex items-center gap-2">
      {twitterHandle && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          asChild
        >
          <a 
            href={`https://twitter.com/${twitterHandle.replace('@', '')}`}
            target="_blank"
            rel="noopener noreferrer"
            title={`@${twitterHandle.replace('@', '')}`}
          >
            <Twitter className="h-4 w-4" />
          </a>
        </Button>
      )}
      
      {linkedinUrl && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          asChild
        >
          <a 
            href={linkedinUrl.startsWith('http') ? linkedinUrl : `https://${linkedinUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            title="LinkedIn"
          >
            <Linkedin className="h-4 w-4" />
          </a>
        </Button>
      )}
      
      {githubHandle && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          asChild
        >
          <a 
            href={`https://github.com/${githubHandle}`}
            target="_blank"
            rel="noopener noreferrer"
            title={githubHandle}
          >
            <Github className="h-4 w-4" />
          </a>
        </Button>
      )}
      
      {websiteUrl && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          asChild
        >
          <a 
            href={websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            title="Website"
          >
            <Globe className="h-4 w-4" />
          </a>
        </Button>
      )}
    </div>
  );
}
