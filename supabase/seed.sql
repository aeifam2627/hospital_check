insert into public.inspection_types (slug,title_th,schedule_mode,sort_order,is_active) values
('medication','ยา','shift',10,true),
('emergency-cart','รถ Emergency','shift',20,true),
('medical-equipment','เครื่องมือแพทย์','daily',30,true)
on conflict (slug) do update set title_th=excluded.title_th,schedule_mode=excluded.schedule_mode,sort_order=excluded.sort_order;

insert into public.inspection_schedules (inspection_type_id,shift_code,required,effective_from)
select id,'daily',true,'2026-08-01' from public.inspection_types where slug='medical-equipment'
on conflict (inspection_type_id,shift_code,effective_from) do nothing;
-- เวลาของยาและรถ Emergency ยังเป็น PENDING จึงเปิดรอบให้กรอก แต่ไม่ถือว่า required และไม่ตั้ง cutoff
insert into public.inspection_schedules (inspection_type_id,shift_code,required,effective_from)
select id,s.code,false,'2026-09-01' from public.inspection_types cross join (values('night'),('morning'),('afternoon')) s(code)
where slug in ('medication','emergency-cart') on conflict (inspection_type_id,shift_code,effective_from) do nothing;

do $$
declare v_type_id uuid; row jsonb; v_item_id uuid; item_order integer:=0;
begin
  select id into v_type_id from public.inspection_types where slug='medication';
  for row in select value from jsonb_array_elements('[
    {"name":"Morphine (ยาเสพติด)","qty":2,"unit":"Amp"},{"name":"Pethidine (ยาเสพติด)","qty":1,"unit":"Amp"},
    {"name":"Dormicum (ยาเสพติด)","qty":2,"unit":"Amp"},{"name":"Fentanyl (ยาเสพติด)","qty":2,"unit":"Amp"},
    {"name":"Ventolin NB (ยาพ่น)","qty":2,"unit":"ขวด"},{"name":"Levophed 4 mg","qty":2,"unit":"Amp"},
    {"name":"7.5%NaHCo3","qty":2,"unit":"Amp"},{"name":"10%calcium gluconate","qty":1,"unit":"Amp"},
    {"name":"Dopamine 500 mg","qty":2,"unit":"Amp"},{"name":"Adrenaline 1 mg","qty":10,"unit":"Amp"},
    {"name":"Diazepam 10 mg","qty":2,"unit":"Amp"},{"name":"Dexamethazone 4 mg","qty":5,"unit":"Amp"},
    {"name":"CPM 10 mg","qty":2,"unit":"Amp"},{"name":"Holoperidol 5 mg","qty":2,"unit":"Amp"},
    {"name":"50%glucose 50 ml","qty":2,"unit":"Amp"},{"name":"ASA 300 mg","qty":5,"unit":"เม็ด"},
    {"name":"Amlodipine 10 mg","qty":5,"unit":"เม็ด"},{"name":"Captopril 25 mg","qty":5,"unit":"เม็ด"},
    {"name":"Clopidogrel 75 mg","qty":8,"unit":"เม็ด"},{"name":"Hydralazine 25 mg","qty":5,"unit":"เม็ด"},
    {"name":"Isordil 5 mg","qty":5,"unit":"เม็ด"},{"name":"HN(70/30) 10 ml (ตู้เย็น)","qty":2,"unit":"ขวด"},
    {"name":"NPH 10 ml (ตู้เย็น)","qty":1,"unit":"ขวด"},{"name":"RI 10 ml (ตู้เย็น)","qty":2,"unit":"ขวด"},
    {"name":"กระเป๋า CPR","qty":2,"unit":"กล่อง"}]'::jsonb)
  loop
    item_order:=item_order+1;
    select i.id into v_item_id from public.inspection_items i where i.inspection_type_id=v_type_id and i.name=row->>'name' limit 1;
    if v_item_id is null then insert into public.inspection_items(inspection_type_id,name,sort_order,active_from) values(v_type_id,row->>'name',item_order,'2026-08-01') returning id into v_item_id; end if;
    insert into public.inspection_variants(item_id,unit,sort_order,active_from) select v_item_id,row->>'unit',1,'2026-08-01' where not exists(select 1 from public.inspection_variants iv where iv.item_id=v_item_id and iv.variant_label is null);
    insert into public.variant_standards(variant_id,standard_qty,effective_from)
      select iv.id,(row->>'qty')::integer,'2026-08-01' from public.inspection_variants iv where iv.item_id=v_item_id and iv.variant_label is null
      on conflict (variant_id,effective_from) do update set standard_qty=excluded.standard_qty;
    v_item_id:=null;
  end loop;
end $$;

do $$
declare v_type_id uuid; row jsonb; v_item_id uuid; v jsonb; item_order integer:=0; variant_order integer;
begin
  select id into v_type_id from public.inspection_types where slug='medical-equipment';
  for row in select value from jsonb_array_elements('[
    {"name":"เครื่อง Defrib","variants":[{"qty":2,"unit":"เครื่อง"}]},{"name":"เครื่อง EKG","variants":[{"qty":1,"unit":"เครื่อง"}]},
    {"name":"เครื่อง NIBP Monitor","variants":[{"qty":10,"unit":"เครื่อง"}]},{"name":"Infusion pump 1 ทาง","variants":[{"qty":14,"unit":"เครื่อง"}]},
    {"name":"Infusion pump Body grad","variants":[{"qty":2,"unit":"เครื่อง"}]},{"name":"เครื่องอุ่นเลือด","variants":[{"qty":1,"unit":"เครื่อง"}]},
    {"name":"เครื่อง O2 Sat","variants":[{"qty":1,"unit":"เครื่อง"}]},{"name":"เครื่องตรวจ Urin space","variants":[{"qty":1,"unit":"เครื่อง"}]},
    {"name":"เครื่องตรวจ DTX","variants":[{"qty":2,"unit":"เครื่อง"}]},{"name":"เครื่อง Suction mobile","variants":[{"qty":1,"unit":"เครื่อง"}]},
    {"name":"BP ตั้งโต๊ะผู้ใหญ่/เด็ก","variants":[{"label":"ผู้ใหญ่","qty":2,"unit":"เครื่อง"},{"label":"เด็ก","qty":1,"unit":"เครื่อง"}]},
    {"name":"ปรอทวัดไข้ดิจิตอล","variants":[{"qty":10,"unit":"เครื่อง"}]},{"name":"Peak Flow","variants":[{"qty":1,"unit":"เครื่อง"}]},
    {"name":"กรรไกรตัดไหม/ตัดเนื้อ","variants":[{"label":"ตัดไหม","qty":2,"unit":"ชิ้น"},{"label":"ตัดเนื้อ","qty":6,"unit":"ชิ้น"}]},
    {"name":"Atery โค้ง/ตรง","variants":[{"label":"โค้ง","qty":2,"unit":"ชิ้น"},{"label":"ตรง","qty":2,"unit":"ชิ้น"}]},
    {"name":"เข็ม Biosy (1 ชุดมี 3 ชิ้น)","variants":[{"qty":1,"unit":"ชุด"}]},{"name":"เข็มเจาะปอด","variants":[{"qty":3,"unit":"ชิ้น"}]},
    {"name":"ด้ามมีด","variants":[{"qty":3,"unit":"ชิ้น"}]},{"name":"HFNC","variants":[{"qty":6,"unit":"ชุด"}]},
    {"name":"Stethoscope","variants":[{"qty":4,"unit":"เครื่อง"}]},{"name":"สายเครื่องช่วยหายใจ","variants":[{"qty":3,"unit":"ชุด"}]}]'::jsonb)
  loop
    item_order:=item_order+1;
    select i.id into v_item_id from public.inspection_items i where i.inspection_type_id=v_type_id and i.name=row->>'name' limit 1;
    if v_item_id is null then insert into public.inspection_items(inspection_type_id,name,sort_order,active_from) values(v_type_id,row->>'name',item_order,'2026-08-01') returning id into v_item_id; end if;
    variant_order:=0;
    for v in select value from jsonb_array_elements(row->'variants') loop
      variant_order:=variant_order+1;
      insert into public.inspection_variants(item_id,variant_label,unit,sort_order,active_from)
        select v_item_id,v->>'label',v->>'unit',variant_order,'2026-08-01'
        where not exists(select 1 from public.inspection_variants iv where iv.item_id=v_item_id and iv.variant_label is not distinct from v->>'label');
      insert into public.variant_standards(variant_id,standard_qty,effective_from)
        select iv.id,(v->>'qty')::integer,'2026-08-01' from public.inspection_variants iv where iv.item_id=v_item_id and iv.variant_label is not distinct from v->>'label'
        on conflict (variant_id,effective_from) do update set standard_qty=excluded.standard_qty;
    end loop;
    v_item_id:=null;
  end loop;
end $$;

-- Emergency: ใส่เฉพาะค่ามาตรฐานที่ระบุชัดในสเปก ค่าที่เหลือรอเจ้าหน้าที่ยืนยันใน Supabase Dashboard
do $$
declare v_type_id uuid; v_group_id uuid; v_item_id uuid; v_variant_id uuid; row jsonb; v jsonb; n integer:=0;
begin
  select id into v_type_id from public.inspection_types where slug='emergency-cart';
  insert into public.inspection_groups(inspection_type_id,name,sort_order) values(v_type_id,'รายการที่ยืนยันแล้ว',0) on conflict(inspection_type_id,name) do nothing;
  select id into v_group_id from public.inspection_groups where inspection_type_id=v_type_id and name='รายการที่ยืนยันแล้ว';
  for row in select value from jsonb_array_elements('[
    {"name":"สาย suction No.14/16","variants":[{"label":"No.14","qty":5,"unit":"เส้น"},{"label":"No.16","qty":5,"unit":"เส้น"}]},
    {"name":"ถุงมือ","variants":[{"label":"ผู้ใหญ่","qty":1,"unit":"คู่"},{"label":"เด็ก","qty":1,"unit":"คู่"}]},
    {"name":"สาย ICD No.28/32","variants":[{"label":"No.28","qty":2,"unit":"เส้น"},{"label":"No.32","qty":2,"unit":"เส้น"}]},
    {"name":"เอี่ยม/แว่นตา","variants":[{"label":"เอี่ยม","qty":5,"unit":"ชิ้น"},{"label":"แว่นตา","qty":2,"unit":"ชิ้น"}]}]'::jsonb)
  loop
    n:=n+1;
    select i.id into v_item_id from public.inspection_items i where i.inspection_type_id=v_type_id and i.name=row->>'name' limit 1;
    if v_item_id is null then insert into public.inspection_items(inspection_type_id,group_id,name,sort_order,active_from) values(v_type_id,v_group_id,row->>'name',n,'2026-08-01') returning id into v_item_id; end if;
    for v in select value from jsonb_array_elements(row->'variants') loop
      select iv.id into v_variant_id from public.inspection_variants iv where iv.item_id=v_item_id and iv.variant_label=v->>'label' limit 1;
      if v_variant_id is null then insert into public.inspection_variants(item_id,variant_label,unit,sort_order,active_from) values(v_item_id,v->>'label',v->>'unit',1,'2026-08-01') returning id into v_variant_id; end if;
      insert into public.variant_standards(variant_id,standard_qty,effective_from) values(v_variant_id,(v->>'qty')::integer,'2026-08-01') on conflict(variant_id,effective_from) do update set standard_qty=excluded.standard_qty;
      v_variant_id:=null;
    end loop;
    v_item_id:=null;
  end loop;
end $$;
