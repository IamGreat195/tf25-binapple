import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Edit, Trash2, MapPin } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Field {
  id: string;
  name: string;
  description: string | null;
  area_hectares: number | null;
  created_at: string;
  mission_count?: number;
  last_mission?: string;
}

interface FieldListProps {
  onEdit: (field: Field) => void;
  onSelect?: (field: Field) => void;
  refresh?: number;
}

const FieldList = ({ onEdit, onSelect, refresh }: FieldListProps) => {
  const [fields, setFields] = useState<Field[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadFields();
  }, [refresh]);

  const loadFields = async () => {
    try {
      const { data: fieldsData, error } = await supabase
        .from('fields')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get mission stats for each field
      const fieldsWithStats = await Promise.all(
        (fieldsData || []).map(async (field) => {
          const { data: missions } = await supabase
            .from('missions')
            .select('completed_at')
            .eq('field_id', field.id)
            .order('completed_at', { ascending: false });

          return {
            ...field,
            mission_count: missions?.length || 0,
            last_mission: missions?.[0]?.completed_at || null,
          };
        })
      );

      setFields(fieldsWithStats);
    } catch (error: any) {
      toast({
        title: 'Error loading fields',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this field?')) return;

    try {
      const { error } = await supabase.from('fields').delete().eq('id', id);
      if (error) throw error;

      toast({ title: 'Field deleted successfully' });
      loadFields();
    } catch (error: any) {
      toast({
        title: 'Error deleting field',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return <div className="text-muted-foreground">Loading fields...</div>;
  }

  if (fields.length === 0) {
    return (
      <Card className="p-8 text-center">
        <MapPin className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-lg font-semibold mb-2">No fields yet</h3>
        <p className="text-muted-foreground">Create your first field to get started</p>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {fields.map((field) => (
        <Card
          key={field.id}
          className="p-4 hover:border-primary transition-colors cursor-pointer"
          onClick={() => onSelect?.(field)}
        >
          <div className="flex justify-between items-start mb-3">
            <div>
              <h3 className="font-semibold text-lg">{field.name}</h3>
              {field.description && (
                <p className="text-sm text-muted-foreground mt-1">{field.description}</p>
              )}
            </div>
          </div>

          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Area</span>
              <span className="font-medium">{field.area_hectares?.toFixed(2) || 'N/A'} ha</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Missions</span>
              <span className="font-medium">{field.mission_count}</span>
            </div>
            {field.last_mission && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Last Mission</span>
                <span className="font-medium">
                  {new Date(field.last_mission).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(field);
              }}
            >
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(field.id);
              }}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
};

export default FieldList;
