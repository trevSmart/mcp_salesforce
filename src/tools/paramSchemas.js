import { z } from 'zod';

export const sObjectNameSchema = z.string().min(1, 'SObject name must be a non-empty string');
export const recordIdSchema = z.string().min(1, 'Record ID must be a non-empty string');
export const fieldsSchema = z.record(z.any());
export const operationSchema = z.enum(['create', 'update', 'delete']);
export const logIdSchema = z.string().min(1, 'Log ID must be a non-empty string');
export const messageSchema = z.string().min(1, 'Message must be a non-empty string');
export const lastDaysSchema = z.number().int().min(1).max(90);
export const createdByNameSchema = z.string().optional();
export const metadataNameSchema = z.string().optional();
export const apexCodeSchema = z.string().min(1, 'Apex code must be a non-empty string');
export const classNameSchema = z.string().min(1, 'Class name must be a non-empty string');
export const methodNameSchema = z.string().optional();
export const soqlQuerySchema = z.string().min(1, 'SOQL query must be a non-empty string');
export const useToolingApiSchema = z.boolean().optional();