import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

import {
  Globe,
  Heart,
  MessageSquare,
  MoreHorizontal,
  Image as ImageIcon,
  FileText,
  Video,
  Send,
  Loader2,
  Trash2,
  Download,
  Bookmark,
  Share2,
  BadgeCheck,
  X
} from "lucide-react";

import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const ACADEMIC_TAGS = ["Dúvida", "Resumo", "Evento", "Desabafo"];
const MARKETPLACE_TAGS = ["Venda de Livro", "República", "Vaga de Estágio", "Doação"];

interface Post {
  id: string;
  user_id: string;
  content: string;
  media_url: string | null;
  tag: string | null;
  created_at: string;
  profiles?: any;
  likes_count: number;
  comments_count: number;
  user_liked: boolean;
  user_saved: boolean;
}

export default function Connect() {

  const { user } = useAuth();
  const { toast } = useToast();

  const [tab, setTab] = useState("global");

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [followingIds, setFollowingIds] = useState<string[]>([]);

  const [newContent, setNewContent] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const [posting, setPosting] = useState(false);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [activePost, setActivePost] = useState<Post | null>(null);
  const [postComments, setPostComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [sendingComment, setSendingComment] = useState(false);


  useEffect(() => {
    if (!user) return;

    loadFollowing();
    loadPosts();

  }, [user, tab]);


  async function loadFollowing() {

    if (!user) return;

    try {

      const { data } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", user.id);

      setFollowingIds((data ?? []).map((f: any) => f.following_id));

    } catch (e) {
      console.error(e);
    }
  }


  async function fetchMetricsForPosts(postsData: any[]) {

    if (!postsData || postsData.length === 0 || !user) return [];

    const postIds = postsData.map(p => p.id);

    const [likes, comments, saved] = await Promise.all([

      supabase
        .from("post_likes")
        .select("post_id,user_id")
        .in("post_id", postIds),

      supabase
        .from("post_comments")
        .select("post_id")
        .in("post_id", postIds),

      supabase
        .from("saved_posts")
        .select("post_id")
        .eq("user_id", user.id)
        .in("post_id", postIds)

    ]);

    const likesMap: any = {};

    (likes.data ?? []).forEach((l: any) => {

      if (!likesMap[l.post_id]) {

        likesMap[l.post_id] = {
          count: 0,
          userLiked: false
        };

      }

      likesMap[l.post_id].count++;

      if (l.user_id === user.id) {

        likesMap[l.post_id].userLiked = true;

      }

    });

    const commentsMap: any = {};

    (comments.data ?? []).forEach((c: any) => {

      commentsMap[c.post_id] = (commentsMap[c.post_id] || 0) + 1;

    });

    const savedSet = new Set(
      (saved.data ?? []).map((s: any) => s.post_id)
    );


    return postsData.map(p => ({

      ...p,

      profiles: Array.isArray(p.profiles)
        ? p.profiles[0]
        : p.profiles,

      likes_count: likesMap[p.id]?.count || 0,

      comments_count: commentsMap[p.id] || 0,

      user_liked: likesMap[p.id]?.userLiked || false,

      user_saved: savedSet.has(p.id)

    }));
  }



  async function loadPosts() {

    setLoading(true);

    try {

      let query = supabase
        .from("posts")
        .select("*, profiles(id,full_name,avatar_url,is_verified)")
        .order("created_at", { ascending: false })
        .limit(50);


      if (tab === "oportunidades") {

        query = query.in("tag", MARKETPLACE_TAGS);

      }


      const { data, error } = await query;

      if (error) throw error;

      if (data) {

        const postsWithMetrics = await fetchMetricsForPosts(data);

        setPosts(postsWithMetrics);

      }

    } catch (e) {

      toast({
        title: "Erro ao carregar feed",
        variant: "destructive"
      });

    } finally {

      setLoading(false);

    }
  }



  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {

    const file = e.target.files?.[0];

    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {

      toast({
        title: "Arquivo muito grande",
        variant: "destructive"
      });

      return;
    }

    setSelectedFile(file);

    if (file.type.startsWith("image/") || file.type.startsWith("video/")) {

      setPreviewUrl(URL.createObjectURL(file));

    } else {

      setPreviewUrl("pdf-preview");

    }

  }



  async function handlePost() {

    if ((!newContent.trim() && !selectedFile) || !user) return;

    setPosting(true);

    try {

      let mediaUrl: string | null = null;

      if (selectedFile) {

        const fileExt = selectedFile.name.split(".").pop();

        const filePath = `${user.id}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase
          .storage
          .from("post_media")
          .upload(filePath, selectedFile);

        if (uploadError) throw uploadError;

        const { data } = supabase
          .storage
          .from("post_media")
          .getPublicUrl(filePath);

        mediaUrl = data.publicUrl;

      }

      const { error } = await supabase
        .from("posts")
        .insert({
          user_id: user.id,
          content: newContent.trim(),
          media_url: mediaUrl,
          tag: selectedTag
        });

      if (error) throw error;

      setNewContent("");
      setSelectedFile(null);
      setPreviewUrl(null);
      setSelectedTag(null);

      toast({
        title: "Publicado!"
      });

      loadPosts();

    } catch (e: any) {

      toast({
        title: "Erro ao postar",
        description: e.message,
        variant: "destructive"
      });

    } finally {

      setPosting(false);

    }
  }

function PostCard({
  post,
  onLike,
  onSave,
  onComment,
  isOwner,
  onDelete
}: any) {

  const isVideo = post.media_url?.match(/\.(mp4|webm|mov)$/i);
  const isPdf = post.media_url?.match(/\.pdf$/i);

  return (

    <Card className="rounded-[32px] overflow-hidden">

      <CardHeader className="flex flex-row items-center justify-between">

        <div className="flex gap-3 items-center">

          <Avatar>

            <AvatarImage src={post.profiles?.avatar_url} />

            <AvatarFallback>
              {post.profiles?.full_name?.charAt(0) || "U"}
            </AvatarFallback>

          </Avatar>

          <div>

            <div className="flex gap-1 items-center">

              <p className="font-bold text-sm">
                {post.profiles?.full_name || "Estudante"}
              </p>

              {post.profiles?.is_verified && (
                <BadgeCheck className="h-4 w-4 text-blue-500"/>
              )}

            </div>

            <p className="text-xs text-muted-foreground">

              {formatDistanceToNow(
                new Date(post.created_at),
                { locale: ptBR, addSuffix: true }
              )}

            </p>

          </div>

        </div>

        <DropdownMenu>

          <DropdownMenuTrigger asChild>

            <Button variant="ghost" size="icon">
              <MoreHorizontal/>
            </Button>

          </DropdownMenuTrigger>

          <DropdownMenuContent align="end">

            {isOwner && (

              <DropdownMenuItem onClick={onDelete}>
                <Trash2 className="h-4 w-4 mr-2"/>
                Excluir
              </DropdownMenuItem>

            )}

            <DropdownMenuItem
              onClick={() => navigator.clipboard.writeText(post.content)}
            >
              <Share2 className="h-4 w-4 mr-2"/>
              Copiar Texto
            </DropdownMenuItem>

          </DropdownMenuContent>

        </DropdownMenu>

      </CardHeader>


      <CardContent>

        {post.tag && (
          <Badge variant="secondary" className="mb-2">
            {post.tag}
          </Badge>
        )}

        <p className="whitespace-pre-wrap text-sm">
          {post.content}
        </p>


        {post.media_url && (

          <div className="mt-4">

            {isPdf ? (

              <Button
                variant="outline"
                onClick={() => window.open(post.media_url)}
              >
                <Download className="h-4 w-4 mr-2"/>
                Baixar PDF
              </Button>

            ) : isVideo ? (

              <video
                src={post.media_url}
                controls
                className="w-full rounded-xl"
              />

            ) : (

              <img
                src={post.media_url}
                className="rounded-xl w-full"
              />

            )}

          </div>

        )}

      </CardContent>


      <CardFooter className="flex justify-between">

        <div className="flex gap-2">

          <Button
            variant="ghost"
            onClick={onLike}
            className={cn(post.user_liked && "text-red-500")}
          >

            <Heart
              className={cn(
                "h-4 w-4",
                post.user_liked && "fill-current"
              )}
            />

            {post.likes_count}

          </Button>


          <Button variant="ghost" onClick={onComment}>

            <MessageSquare className="h-4 w-4"/>

            {post.comments_count}

          </Button>

        </div>


        <Button
          variant="ghost"
          size="icon"
          onClick={onSave}
        >

          <Bookmark
            className={cn(
              "h-4 w-4",
              post.user_saved && "fill-current"
            )}
          />

        </Button>

      </CardFooter>

    </Card>

  );
}
