import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import MissionMap from '@/components/Map/MissionMap';
import { useNavigate } from 'react-router-dom';

const missionSchema = z.object({
  name: z.string().min(1, 'Mission name is required'),
  field_id: z.string().min(1, 'Field is required'),
  mission_type: z.enum(['spraying', 'scouting', 'mapping', 'custom']),
  altitude_meters: z.number().min(1).max(500),
  speed_ms: z.number().min(1).max(30),
});

interface Field {
  id: string;
  name: string;
  polygon: any;
}

const MissionForm = () => {
  const [fields, setFields] = useState<Field[]>([]);
  const [selectedField, setSelectedField] = useState<Field | null>(null);
  const [pathline, setPathline] = useState<number[][]>([]);
  const [distance, setDistance] = useState(0);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const form = useForm({
    resolver: zodResolver(missionSchema),
    defaultValues: {
      name: '',
      field_id: '',
      mission_type: 'scouting' as const,
      altitude_meters: 50,
      speed_ms: 10,
    },
  });

  useEffect(() => {
    loadFields();
  }, []);

  const loadFields = async () => {
    try {
      const { data, error } = await supabase
        .from('fields')
        .select('id, name, polygon')
        .order('name');

      if (error) throw error;
      setFields(data || []);
    } catch (error: any) {
      toast({
        title: 'Error loading fields',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const onSubmit = async (values: z.infer<typeof missionSchema>) => {
    if (pathline.length === 0) {
      toast({
        title: 'Please draw a mission pathline',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('missions')
        .insert({
          name: values.name,
          field_id: values.field_id,
          mission_type: values.mission_type,
          altitude_meters: values.altitude_meters,
          speed_ms: values.speed_ms,
          pathline: pathline,
          status: 'planned',
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      toast({ title: 'Mission created successfully' });
      navigate(`/missions/${data.id}`);
    } catch (error: any) {
      toast({
        title: 'Error creating mission',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Mission Name</FormLabel>
                <FormControl>
                  <Input placeholder="Morning Spray Mission" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="field_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Field</FormLabel>
                <Select
                  onValueChange={(value) => {
                    field.onChange(value);
                    const selected = fields.find(f => f.id === value);
                    setSelectedField(selected || null);
                  }}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a field" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {fields.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="mission_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Mission Type</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="spraying">Spraying</SelectItem>
                    <SelectItem value="scouting">Scouting</SelectItem>
                    <SelectItem value="mapping">Mapping</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="altitude_meters"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Altitude (meters)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    {...field}
                    onChange={(e) => field.onChange(parseFloat(e.target.value))}
                  />
                </FormControl>
                <FormDescription>Flight altitude: 1-500 meters</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="speed_ms"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Speed (m/s)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    {...field}
                    onChange={(e) => field.onChange(parseFloat(e.target.value))}
                  />
                </FormControl>
                <FormDescription>Flight speed: 1-30 m/s</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div>
          <FormLabel className="mb-2 block">Mission Path</FormLabel>
          <p className="text-sm text-muted-foreground mb-4">
            Draw the flight path for the drone. Select a field first to see the boundary.
          </p>
          <MissionMap
            onPathlineChange={(coords, dist) => {
              setPathline(coords);
              setDistance(dist);
            }}
            fieldPolygon={selectedField?.polygon}
          />
        </div>

        <div className="flex gap-3 justify-end">
          <Button type="button" variant="outline" onClick={() => navigate('/missions')}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Creating...' : 'Create Mission'}
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default MissionForm;
