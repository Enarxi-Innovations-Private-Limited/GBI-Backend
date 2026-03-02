import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

@ValidatorConstraint({ name: 'isNotArray', async: false })
export class IsNotArrayConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {
    return !Array.isArray(value);
  }

  defaultMessage(args: ValidationArguments) {
    return (
      args.constraints?.[0] ||
      'Multiple values are not allowed for this parameter'
    );
  }
}

export function IsNotArray(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [validationOptions?.message],
      validator: IsNotArrayConstraint,
    });
  };
}
