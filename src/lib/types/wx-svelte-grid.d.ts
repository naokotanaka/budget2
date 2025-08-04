declare module 'wx-svelte-grid' {
  export interface GridColumn {
    id: string;
    header: string;
    width?: number;
    sort?: boolean;
    align?: 'left' | 'center' | 'right';
    template?: (value: any) => string;
  }

  export interface GridProps {
    data: any[];
    columns: GridColumn[];
  }

  export class Grid {
    $$prop_def: GridProps;
  }
}