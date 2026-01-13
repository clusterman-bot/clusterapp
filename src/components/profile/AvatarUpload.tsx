import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUpdateProfile } from '@/hooks/useProfile';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Camera, Loader2, ZoomIn, Move } from 'lucide-react';

interface AvatarUploadProps {
  currentAvatarUrl?: string | null;
  displayName?: string | null;
  username?: string | null;
  size?: 'sm' | 'md' | 'lg';
  onUploadComplete?: (url: string) => void;
}

export function AvatarUpload({ 
  currentAvatarUrl, 
  displayName, 
  username, 
  size = 'lg',
  onUploadComplete 
}: AvatarUploadProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const updateProfile = useUpdateProfile();
  const [isUploading, setIsUploading] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [zoom, setZoom] = useState([1]);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const sizeClasses = {
    sm: 'h-16 w-16',
    md: 'h-20 w-20',
    lg: 'h-24 w-24',
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload an image file',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Please upload an image smaller than 5MB',
        variant: 'destructive',
      });
      return;
    }

    // Read the file and open editor
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        imageRef.current = img;
        setSelectedImage(e.target?.result as string);
        setSelectedFile(file);
        setZoom([1]);
        setPosition({ x: 0, y: 0 });
        setIsEditorOpen(true);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  }, [position]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    
    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;
    
    // Limit position based on zoom
    const limit = 100 * (zoom[0] - 1);
    setPosition({
      x: Math.max(-limit, Math.min(limit, newX)),
      y: Math.max(-limit, Math.min(limit, newY))
    });
  }, [isDragging, dragStart, zoom]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const processAndUpload = async () => {
    if (!selectedFile || !user || !imageRef.current) return;

    setIsUploading(true);

    try {
      const canvas = canvasRef.current;
      if (!canvas) throw new Error('Canvas not found');

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context not found');

      const outputSize = 256;
      canvas.width = outputSize;
      canvas.height = outputSize;

      const img = imageRef.current;
      const scale = zoom[0];
      
      // Calculate dimensions to fit image in circle
      const minDimension = Math.min(img.width, img.height);
      const scaledSize = minDimension * scale;
      
      // Calculate source position (center crop)
      const srcX = (img.width - minDimension) / 2 - (position.x / 100) * (minDimension / 2);
      const srcY = (img.height - minDimension) / 2 - (position.y / 100) * (minDimension / 2);
      
      // Draw the cropped and scaled image
      ctx.save();
      ctx.beginPath();
      ctx.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      
      ctx.drawImage(
        img,
        srcX / scale,
        srcY / scale,
        minDimension / scale,
        minDimension / scale,
        0,
        0,
        outputSize,
        outputSize
      );
      ctx.restore();

      // Convert canvas to blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to create blob'));
        }, 'image/png', 0.9);
      });

      // Generate unique filename
      const fileName = `${user.id}/${Date.now()}.png`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, blob, { upsert: true, contentType: 'image/png' });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      // Update profile with new avatar URL
      await updateProfile.mutateAsync({ avatar_url: publicUrl });

      toast({ title: 'Avatar updated successfully' });
      onUploadComplete?.(publicUrl);
      setIsEditorOpen(false);
      setSelectedImage(null);
      setSelectedFile(null);
    } catch (error: any) {
      console.error('Avatar upload error:', error);
      toast({
        title: 'Failed to upload avatar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
      <div className="relative group">
        <Avatar className={sizeClasses[size]}>
          <AvatarImage src={currentAvatarUrl || undefined} />
          <AvatarFallback className="text-2xl">
            {displayName?.[0] || username?.[0] || '?'}
          </AvatarFallback>
        </Avatar>
        
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
        
        <Button
          variant="secondary"
          size="icon"
          className="absolute bottom-0 right-0 h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          {isUploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Camera className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Hidden canvas for processing */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Image Editor Dialog */}
      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adjust Your Photo</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Preview Area */}
            <div 
              className="relative w-48 h-48 mx-auto rounded-full overflow-hidden border-2 border-dashed border-muted-foreground/25 cursor-move select-none"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              {selectedImage && (
                <img
                  src={selectedImage}
                  alt="Preview"
                  className="absolute w-full h-full object-cover pointer-events-none"
                  style={{
                    transform: `scale(${zoom[0]}) translate(${position.x / zoom[0]}px, ${position.y / zoom[0]}px)`,
                    transformOrigin: 'center center'
                  }}
                  draggable={false}
                />
              )}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <Move className="h-6 w-6 text-white/50" />
              </div>
            </div>

            {/* Zoom Control */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <ZoomIn className="h-4 w-4" />
                  Zoom
                </span>
                <span className="text-muted-foreground">{Math.round(zoom[0] * 100)}%</span>
              </div>
              <Slider
                value={zoom}
                onValueChange={setZoom}
                min={1}
                max={3}
                step={0.1}
              />
            </div>

            <p className="text-xs text-center text-muted-foreground">
              Drag to reposition • Use slider to zoom
            </p>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => {
                  setIsEditorOpen(false);
                  setSelectedImage(null);
                  setSelectedFile(null);
                }}
              >
                Cancel
              </Button>
              <Button 
                className="flex-1"
                onClick={processAndUpload}
                disabled={isUploading}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  'Save Photo'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
